/**
 * Deterministic remediation banks + AI-targeted generation glue.
 * Prefer templates for POS / recognition; AI for open production.
 */
import type { Activity, LessonContent } from "@/types/activity";
import { expandFromPattern } from "@/lib/activities/templates";

export type RemediationFocus = {
  weakSkills: string[];
  weakTypes: string[];
  recentIssues: string[];
  failedPrompts: string[];
  unmetDetails: string[];
};

let genCounter = 0;
function gid(prefix: string) {
  genCounter += 1;
  return `gen-${prefix}-${Date.now().toString(36)}-${genCounter}`;
}

/** Built-in English POS drills — no API key required. */
const POS_MATCH_BANK: { left: string; job: "noun" | "verb" | "adj" }[] = [
  { left: "The **dog** barks.", job: "noun" },
  { left: "The dog **barks**.", job: "verb" },
  { left: "A **road** leads home.", job: "noun" },
  { left: "She **carries** water.", job: "verb" },
  { left: "**Rome** is famous.", job: "noun" },
  { left: "They **are** ready.", job: "verb" },
  { left: "The **forest** is dark.", job: "noun" },
  { left: "He **sees** the land.", job: "verb" },
  { left: "Cold **water** helps.", job: "noun" },
  { left: "We **love** peace.", job: "verb" },
  { left: "The **girl** walks.", job: "noun" },
  { left: "Farmers **work** hard.", job: "verb" },
];

const POS_MULTI_BANK: {
  sentence: string;
  options: { id: string; label: string }[];
  correct: string[];
  skill: string;
}[] = [
  {
    sentence: "Pick ALL nouns: “The farmer carries grain to Rome.”",
    options: [
      { id: "farmer", "label": "farmer" },
      { id: "carries", "label": "carries" },
      { id: "grain", "label": "grain" },
      { id: "rome", "label": "Rome" },
    ],
    correct: ["farmer", "grain", "rome"],
    skill: "noun",
  },
  {
    sentence: "Pick ALL verbs: “The girls are happy and they sing.”",
    options: [
      { id: "girls", "label": "girls" },
      { id: "are", "label": "are" },
      { id: "happy", "label": "happy" },
      { id: "sing", "label": "sing" },
    ],
    correct: ["are", "sing"],
    skill: "verb",
  },
  {
    sentence: "Pick ALL adjectives: “The large cold villa stands nearby.”",
    options: [
      { id: "large", "label": "large" },
      { id: "cold", "label": "cold" },
      { id: "villa", "label": "villa" },
      { id: "stands", "label": "stands" },
    ],
    correct: ["large", "cold"],
    skill: "adjective",
  },
  {
    sentence: "Pick ALL prepositions: “She walks from the road into the forest.”",
    options: [
      { id: "from", "label": "from" },
      { id: "road", "label": "road" },
      { id: "into", "label": "into" },
      { id: "walks", "label": "walks" },
    ],
    correct: ["from", "into"],
    skill: "preposition",
  },
];

const CASE_MATCH_BANK: { left: string; right: string; skill: string }[][] = [
  [
    { left: "Subject of the verb", right: "nominative", skill: "nominative" },
    { left: "Direct object", right: "accusative", skill: "accusative" },
    { left: "Of / possession", right: "genitive", skill: "genitive" },
    { left: "To / for", right: "dative", skill: "dative" },
    { left: "Place where (after in)", right: "ablative", skill: "ablative" },
  ],
];

function pick<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length === 0) return [];
  const out: T[] = [];
  let s = seed >>> 0 || 1;
  const used = new Set<number>();
  while (out.length < Math.min(n, arr.length)) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const i = s % arr.length;
    if (!used.has(i)) {
      used.add(i);
      out.push(arr[i]!);
    }
  }
  return out;
}

/** Template remediation for skills that don't need an LLM. */
export function generateTemplateRemediation(
  lesson: LessonContent,
  focus: RemediationFocus,
  count = 3
): Activity[] {
  const skills = new Set(
    focus.weakSkills.length
      ? focus.weakSkills
      : lesson.allowList.constructions
  );
  const out: Activity[] = [];
  const seed = Date.now() % 100000;

  const wantsPos =
    [...skills].some((s) =>
      ["noun", "verb", "adjective", "preposition", "parts of speech", "pos"].includes(
        s.toLowerCase()
      )
    ) ||
    lesson.unitSlug.includes("parts-of-speech") ||
    lesson.allowList.constructions.some((c) =>
      c.toLowerCase().includes("part")
    );

  const wantsCase =
    [...skills].some((s) =>
      [
        "nominative",
        "accusative",
        "genitive",
        "dative",
        "ablative",
        "case",
      ].some((k) => s.toLowerCase().includes(k))
    ) || lesson.unitSlug.includes("noun-cases");

  if (wantsPos && out.length < count) {
    const items = pick(POS_MATCH_BANK, 4, seed);
    if (items.length >= 2) {
      const left = items.map((it, i) => ({
        id: `l${i}`,
        label: it.left,
      }));
      // Only noun/verb in this bank pair — map jobs
      const rightIds = [
        { id: "noun", label: "Noun" },
        { id: "verb", label: "Verb" },
      ];
      const pairs: Record<string, string> = {};
      items.forEach((it, i) => {
        pairs[`l${i}`] = it.job === "adj" ? "noun" : it.job;
      });
      // filter to noun/verb only items
      const nv = items.filter((it) => it.job === "noun" || it.job === "verb");
      if (nv.length >= 2) {
        const left2 = nv.map((it, i) => ({ id: `l${i}`, label: it.left }));
        const pairs2: Record<string, string> = {};
        nv.forEach((it, i) => {
          pairs2[`l${i}`] = it.job;
        });
        out.push({
          id: gid("pos-match"),
          type: "matching",
          source: "generated",
          prompt: "Match each bold word to noun or verb.",
          targets: ["noun", "verb", "parts of speech"],
          required: true,
          payload: {
            leftLabel: "Word in context",
            rightLabel: "Job",
            left: left2,
            right: rightIds,
            pairs: pairs2,
          },
        });
      }
    }

    const multi = pick(
      POS_MULTI_BANK.filter(
        (m) =>
          skills.size === 0 ||
          [...skills].some(
            (s) =>
              m.skill.includes(s.toLowerCase()) ||
              s.toLowerCase().includes(m.skill)
          ) ||
          skills.has("parts of speech")
      ),
      2,
      seed + 7
    );
    for (const m of multi) {
      if (out.length >= count) break;
      out.push({
        id: gid("pos-multi"),
        type: "multi_select",
        source: "generated",
        prompt: m.sentence,
        targets: [m.skill, "parts of speech"],
        required: true,
        payload: {
          options: m.options,
          correctOptionIds: m.correct,
        },
      });
    }
  }

  if (wantsCase && out.length < count) {
    const bank = CASE_MATCH_BANK[0]!;
    const subset = pick(bank, 4, seed + 3);
    if (subset.length >= 3) {
      const left = subset.map((it, i) => ({
        id: `c${i}`,
        label: it.left,
      }));
      const right = subset.map((it, i) => ({
        id: `r${i}`,
        label: it.right,
      }));
      // shuffle right labels mapping: pairs left id -> right id with same index skill
      const pairs: Record<string, string> = {};
      subset.forEach((_, i) => {
        pairs[`c${i}`] = `r${i}`;
      });
      out.push({
        id: gid("case-match"),
        type: "matching",
        source: "generated",
        prompt: "Match each job to the correct case name.",
        targets: subset.map((s) => s.skill).concat(["case"]),
        required: true,
        payload: {
          leftLabel: "Job",
          rightLabel: "Case",
          left,
          right,
          pairs,
        },
      });
    }

    // mini MC for weak case
    for (const skill of focus.weakSkills) {
      if (out.length >= count) break;
      const key = skill.toLowerCase();
      const map: Record<string, { q: string; correct: string; wrong: string[] }> =
        {
          nominative: {
            q: "Which case marks the subject of the verb?",
            correct: "Nominative",
            wrong: ["Accusative", "Genitive", "Ablative"],
          },
          accusative: {
            q: "Which case marks the direct object?",
            correct: "Accusative",
            wrong: ["Nominative", "Dative", "Genitive"],
          },
          genitive: {
            q: "Which case often means “of” / possession?",
            correct: "Genitive",
            wrong: ["Dative", "Ablative", "Nominative"],
          },
          dative: {
            q: "Which case often means “to/for” (indirect object)?",
            correct: "Dative",
            wrong: ["Genitive", "Accusative", "Nominative"],
          },
          ablative: {
            q: "Which case is used for place where after in?",
            correct: "Ablative",
            wrong: ["Accusative", "Nominative", "Genitive"],
          },
        };
      const item = map[key];
      if (!item) continue;
      const opts = [item.correct, ...item.wrong].map((label, i) => ({
        id: `o${i}`,
        label,
      }));
      // correct is always o0 before shuffle — shuffle options but track correct id
      const correctId = "o0";
      out.push({
        id: gid("case-mc"),
        type: "multiple_choice",
        source: "generated",
        prompt: item.q,
        targets: [skill, "case"],
        required: true,
        payload: {
          options: opts,
          correctOptionId: correctId,
        },
      });
    }
  }

  // First-declension single forms when weak on endings
  if (
    (focus.weakTypes.includes("single_form") ||
      focus.weakTypes.includes("paradigm_grid") ||
      skills.has("1st declension") ||
      lesson.unitSlug.includes("first-declension")) &&
    out.length < count
  ) {
    const forms = [
      { prompt: "Nominative singular of via", accept: ["via"] },
      { prompt: "Accusative singular of puella", accept: ["puellam"] },
      { prompt: "Genitive singular of aqua", accept: ["aquae"] },
      { prompt: "Ablative singular of terra (macron optional)", accept: ["terra", "terrā"] },
      { prompt: "Nominative plural of puella", accept: ["puellae"] },
    ];
    for (const f of pick(forms, 2, seed + 11)) {
      if (out.length >= count) break;
      out.push({
        id: gid("form"),
        type: "single_form",
        source: "generated",
        prompt: f.prompt,
        targets: ["1st declension", "endings"],
        required: true,
        payload: { accept: f.accept },
      });
    }
  }

  return out.map((a) => expandFromPattern(a)).slice(0, count);
}

export function describeFocus(focus: RemediationFocus): string {
  const bits: string[] = [];
  if (focus.weakSkills.length)
    bits.push(`skills: ${focus.weakSkills.join(", ")}`);
  if (focus.weakTypes.length) bits.push(`types: ${focus.weakTypes.join(", ")}`);
  if (focus.recentIssues.length)
    bits.push(`issues: ${focus.recentIssues.slice(0, 5).join(", ")}`);
  if (focus.unmetDetails.length)
    bits.push(`unmet: ${focus.unmetDetails.join("; ")}`);
  return bits.join(" · ") || "general lesson practice";
}
