import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { Activity, LessonContent } from "@/types/activity";
import {
  loadLesson,
  listAllLessons,
  listLessonSlugs,
  listUnits,
} from "@/lib/content";

export type Flashcard = {
  /** Stable across sessions for the same Latin|English pair */
  key: string;
  /** Always Latin (shown first) */
  front: string;
  /** Always English (shown after flip) */
  back: string;
  kind: "vocab" | "match" | "form" | "fact" | "translate";
  sourceLesson: string;
  sourceUnit?: string;
};

export type FlashcardWithStats = Flashcard & {
  correctCount: number;
  wrongCount: number;
  streak: number;
  lastResult: string | null;
};

function norm(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cardKey(front: string, back: string): string {
  const raw = `${norm(front)}||${norm(back)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function stripMacron(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Rough: looks like a Latin lemma / short Latin phrase, not English prose. */
function looksLatin(s: string): boolean {
  const t = s.replace(/\*\*/g, "").trim();
  if (!t || t.length > 48) return false;
  // macrons / common Latin letters
  if (/[āēīōūȳĀĒĪŌŪăĕĭŏŭ]/.test(t)) return true;
  // single token, not a full English sentence
  if (/\s/.test(t) && t.split(/\s+/).length > 3) return false;
  // English glosses often have "the", "to ", "a "
  if (/^(the|a|an|to|of|by|with|from|into|for|and)\s/i.test(t)) return false;
  if (/^(who|what|where|when|how|which)\b/i.test(t)) return false;
  // Latin-ish endings
  if (
    /(?:us|um|a|ae|is|em|ēs|ī|ō|ibus|unt|ant|ent|o|are|ere|ire|īre)$/i.test(
      stripMacron(t).replace(/[.,;:!?]$/, "")
    )
  ) {
    return true;
  }
  // short single word without English-only letters patterns
  if (!/\s/.test(t) && t.length <= 20 && !/^(i|you|he|she|it|we|they|my|your)$/i.test(t)) {
    return true;
  }
  return false;
}

function looksEnglish(s: string): boolean {
  const t = s.replace(/\*\*/g, "").trim();
  if (!t) return false;
  if (/[āēīōūȳĀĒĪŌŪ]/.test(t)) return false;
  if (/^(the|a|an|to|of|by|with|from|into|for)\s/i.test(t)) return true;
  if (/\s/.test(t)) return true; // multi-word gloss
  // common single-word English glosses
  if (
    /^(girl|boy|woman|man|water|road|war|love|work|see|hear|king|city|soldier|good|bad|great|small|today|tomorrow|now|not|with|who|what)$/i.test(
      t
    )
  ) {
    return true;
  }
  return !looksLatin(t);
}

/**
 * Push a card as Latin (front) → English (back) only.
 * If sides are swapped, reorient when we can tell.
 */
function pushLatinEnglish(
  out: Map<string, Flashcard>,
  a: string,
  b: string,
  kind: Flashcard["kind"],
  sourceLesson: string,
  sourceUnit?: string
) {
  let latin = a.replace(/\*\*/g, "").trim();
  let english = b.replace(/\*\*/g, "").trim();
  if (!latin || !english) return;
  if (norm(latin) === norm(english)) return;

  const aLat = looksLatin(latin);
  const bLat = looksLatin(english);
  const aEng = looksEnglish(latin);
  const bEng = looksEnglish(english);

  // If clearly reversed (English first, Latin second), swap
  if ((!aLat && bLat) || (aEng && bLat && !bEng)) {
    [latin, english] = [english, latin];
  } else if (aLat && bLat) {
    // both look Latin — skip reverse pairs; keep as-is only if short lemma
    if (latin.length > 30) return;
  } else if (!aLat && !bLat) {
    // both English-ish — skip (not a L→E vocab card)
    return;
  }

  // Prefer short Latin headwords for front
  if (latin.length > 80 || english.length > 160) return;

  const key = cardKey(latin, english);
  if (out.has(key)) return;
  out.set(key, {
    key,
    front: latin,
    back: english,
    kind,
    sourceLesson,
    sourceUnit,
  });
}

/** lemma (lowercase, no macrons) → gloss from year1 batches */
let glossIndex: Map<string, string> | null = null;
/** gloss lower → lemma (for matching reverse pairs) */
let lemmaByGloss: Map<string, string> | null = null;

export function getVocabGlossIndex(): Map<string, string> {
  if (glossIndex) return glossIndex;
  glossIndex = new Map();
  lemmaByGloss = new Map();
  try {
    const p = path.join(process.cwd(), "content", "vocab", "year1-batches.json");
    if (!fs.existsSync(p)) return glossIndex;
    const bank = JSON.parse(fs.readFileSync(p, "utf8")) as {
      batches: { entries: { lemma: string; gloss: string }[] }[];
    };
    for (const batch of bank.batches ?? []) {
      for (const e of batch.entries ?? []) {
        const lemma = e.lemma.split(/[/,]/)[0]?.trim() ?? e.lemma;
        const gloss = e.gloss.trim();
        glossIndex.set(stripMacron(lemma), gloss);
        glossIndex.set(lemma.toLowerCase(), gloss);
        lemmaByGloss.set(norm(gloss), lemma);
        // first sense only
        const first = gloss.split(/[,;]/)[0]?.trim();
        if (first) lemmaByGloss.set(norm(first), lemma);
      }
    }
  } catch {
    /* ignore */
  }
  return glossIndex;
}

function cardsFromActivity(
  a: Activity,
  lessonSlug: string,
  unitSlug: string,
  out: Map<string, Flashcard>
) {
  switch (a.type) {
    case "matching": {
      const p = a.payload;
      const rightById = new Map(p.right.map((r) => [r.id, r.label]));
      const leftIsLatinHint =
        /latin/i.test(p.leftLabel ?? "") ||
        !/english/i.test(p.leftLabel ?? "");
      for (const left of p.left) {
        const rightId = p.pairs[left.id];
        const right = rightId ? rightById.get(rightId) : undefined;
        if (!right) continue;
        if (leftIsLatinHint && /english/i.test(p.rightLabel ?? "English")) {
          pushLatinEnglish(
            out,
            left.label,
            right,
            "match",
            lessonSlug,
            unitSlug
          );
        } else if (/english/i.test(p.leftLabel ?? "")) {
          pushLatinEnglish(
            out,
            right,
            left.label,
            "match",
            lessonSlug,
            unitSlug
          );
        } else {
          pushLatinEnglish(
            out,
            left.label,
            right,
            "match",
            lessonSlug,
            unitSlug
          );
        }
      }
      break;
    }
    case "multiple_choice": {
      // "What does **puella** mean?" → puella / girl
      const p = a.payload;
      const correct = p.options.find((o) => o.id === p.correctOptionId);
      if (!correct || !a.prompt) break;
      const m =
        a.prompt.match(/\*\*([^*]+)\*\*/) ??
        a.prompt.match(/What does\s+(.+?)\s+mean/i);
      const lemma = m?.[1]?.replace(/\?$/, "").trim();
      if (lemma && looksLatin(lemma)) {
        pushLatinEnglish(
          out,
          lemma,
          correct.label,
          "fact",
          lessonSlug,
          unitSlug
        );
      }
      break;
    }
    case "single_form": {
      // "English meaning of **puella**:" → accept
      const accept = a.payload.accept?.[0];
      if (!accept || !a.prompt) break;
      const m = a.prompt.match(/\*\*([^*]+)\*\*/);
      const lemma = m?.[1]?.trim();
      if (lemma && looksLatin(lemma) && looksEnglish(accept)) {
        pushLatinEnglish(out, lemma, accept, "form", lessonSlug, unitSlug);
      }
      break;
    }
    case "translate": {
      // Word-level L2E only
      if (a.payload.direction !== "L2E") break;
      if (a.payload.length && a.payload.length !== "word") break;
      const sample = a.payload.sampleAnswers?.[0];
      if (!sample || !a.prompt) break;
      const front = a.prompt
        .replace(/^Translate(\s+from the passage)?:\s*/i, "")
        .replace(/^Translate:\s*/i, "")
        .replace(/\*\*/g, "")
        .trim();
      if (front && looksLatin(front) && front.length < 40) {
        pushLatinEnglish(
          out,
          front,
          sample,
          "translate",
          lessonSlug,
          unitSlug
        );
      }
      break;
    }
    default:
      break;
  }
}

export function extractCardsFromLesson(lesson: LessonContent): Flashcard[] {
  const out = new Map<string, Flashcard>();
  const glosses = getVocabGlossIndex();

  for (const a of lesson.seeds) {
    cardsFromActivity(a, lesson.slug, lesson.unitSlug, out);
  }

  // Lemma list → English gloss (Latin front only)
  for (const lemma of lesson.allowList.lemmas ?? []) {
    const g =
      glosses.get(stripMacron(lemma)) ?? glosses.get(lemma.toLowerCase());
    if (g) {
      pushLatinEnglish(out, lemma, g, "vocab", lesson.slug, lesson.unitSlug);
    }
  }

  return [...out.values()];
}

export function extractCardsFromLessonSlugs(slugs: string[]): Flashcard[] {
  const out = new Map<string, Flashcard>();
  const all = listAllLessons();
  const bySlug = new Map(all.map((l) => [l.slug, l]));

  for (const slug of slugs) {
    let lesson = bySlug.get(slug) ?? null;
    if (!lesson) {
      for (const u of listUnits()) {
        if (listLessonSlugs(u.slug).includes(slug)) {
          lesson = loadLesson(u.slug, slug);
          break;
        }
      }
    }
    if (!lesson) continue;
    for (const c of extractCardsFromLesson(lesson)) {
      if (!out.has(c.key)) out.set(c.key, c);
    }
  }
  return [...out.values()];
}

/** Sort: weakest first (more wrongs, fewer corrects), then unseen. */
export function sortDeckForPractice(
  cards: Flashcard[],
  stats: Map<
    string,
    {
      correctCount: number;
      wrongCount: number;
      streak: number;
      lastResult: string | null;
    }
  >
): FlashcardWithStats[] {
  const withStats: FlashcardWithStats[] = cards.map((c) => {
    const s = stats.get(c.key);
    return {
      ...c,
      correctCount: s?.correctCount ?? 0,
      wrongCount: s?.wrongCount ?? 0,
      streak: s?.streak ?? 0,
      lastResult: s?.lastResult ?? null,
    };
  });

  withStats.sort((a, b) => {
    const score = (x: FlashcardWithStats) => {
      const total = x.correctCount + x.wrongCount;
      if (total === 0) return 1000;
      const rate = x.wrongCount / total;
      return rate * 100 + x.wrongCount * 2 - x.streak;
    };
    const aFail = a.wrongCount > a.correctCount ? 1 : 0;
    const bFail = b.wrongCount > b.correctCount ? 1 : 0;
    if (aFail !== bFail) return bFail - aFail;
    return score(b) - score(a);
  });

  return withStats;
}
