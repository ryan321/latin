import { complete, modelFor, REASONING_OFF } from "@/lib/openrouter";
import { expandFromPattern } from "@/lib/activities/templates";
import {
  generateTemplateRemediation,
  describeFocus,
  type RemediationFocus,
} from "@/lib/activities/remediate";
import {
  activitySchema,
  type Activity,
  type LessonContent,
} from "@/types/activity";
import { z } from "zod";

const generatedListSchema = z.object({
  activities: z.array(z.unknown()),
});

function extractJson(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  const brace = cleaned.match(/\{[\s\S]*\}/);
  if (brace) cleaned = brace[0];
  return JSON.parse(cleaned);
}

/**
 * Build more practice aimed only at weak skills / unmet standard pieces.
 * 1) Deterministic templates first (POS, cases, forms)
 * 2) AI fills remaining slots when API key present
 */
export async function generateTargetedPractice(args: {
  lesson: LessonContent;
  focus: RemediationFocus;
  count?: number;
}): Promise<{ activities: Activity[]; focusSummary: string; source: string }> {
  const n = args.count ?? 3;
  const focusSummary = describeFocus(args.focus);

  const templated = generateTemplateRemediation(
    args.lesson,
    args.focus,
    n
  );

  if (templated.length >= n || !process.env.OPENROUTER_API_KEY) {
    return {
      activities: templated.slice(0, n),
      focusSummary,
      source: templated.length ? "templates" : "none",
    };
  }

  const need = n - templated.length;
  let fromAi: Activity[] = [];
  try {
    fromAi = await generateActivitiesWithAi({
      lesson: args.lesson,
      focus: args.focus,
      focusSummary,
      count: need,
    });
  } catch (err) {
    console.error("AI generate failed, using templates only", err);
  }

  return {
    activities: [...templated, ...fromAi].slice(0, n),
    focusSummary,
    source: fromAi.length ? "templates+ai" : "templates",
  };
}

async function generateActivitiesWithAi(args: {
  lesson: LessonContent;
  focus: RemediationFocus;
  focusSummary: string;
  count: number;
}): Promise<Activity[]> {
  const types = args.lesson.allowList.activityTypes.length
    ? args.lesson.allowList.activityTypes
    : (["matching", "multi_select", "multiple_choice", "single_form", "translate"] as const);

  const n = args.count;
  const skillFocus =
    args.focus.weakSkills.join(", ") ||
    args.lesson.allowList.constructions.join(", ") ||
    "lesson skills";

  const system = `You create TARGETED extra practice for a high-school Year 1 Latin student.
ONLY practice what they are weak on — do NOT re-teach skills they already passed.

FOCUS (must target these only):
${args.focusSummary}
Weak skills: ${skillFocus}
Weak activity types (prefer): ${args.focus.weakTypes.join(", ") || "any allowed"}
Recent grader issues: ${args.focus.recentIssues.join(", ") || "none"}
Failed item prompts (for style, do not copy verbatim): ${args.focus.failedPrompts.join(" | ") || "none"}

Output strict JSON only:
{"activities":[ ... ]}

Allowed shapes (use only types in: ${types.join(", ")}):

matching:
{"id":"gen-...","type":"matching","source":"generated","prompt":"...","targets":["skill-tags"],"required":true,"payload":{"left":[{"id":"a","label":"The **girl** runs."}],"right":[{"id":"noun","label":"Noun"},{"id":"verb","label":"Verb"}],"pairs":{"a":"noun"},"leftLabel":"...","rightLabel":"..."}}

multi_select:
{"id":"gen-...","type":"multi_select","source":"generated","prompt":"Select ALL nouns: …","targets":["noun"],"required":true,"payload":{"options":[{"id":"x","label":"…"}],"correctOptionIds":["x"]}}

multiple_choice:
{"id":"gen-...","type":"multiple_choice","source":"generated","prompt":"...","targets":["…"],"required":true,"payload":{"options":[{"id":"a","label":"…"}],"correctOptionId":"a"}}

single_form:
{"id":"gen-...","type":"single_form","source":"generated","prompt":"…","targets":["1st declension"],"required":true,"payload":{"accept":["viae"]}}

translate:
{"id":"gen-...","type":"translate","source":"generated","prompt":"…","targets":["…"],"required":true,"payload":{"direction":"L2E","length":"sentence","sampleAnswers":["…"],"rubric":"…"}}

paradigm_grid stub:
{"id":"gen-...","type":"paradigm_grid","source":"generated","prompt":"Decline terra","targets":["1st declension"],"required":true,"payload":{"kind":"noun","lemma":"terra","stem":"terr","pattern":"first_declension","mode":"full_form","labels":{"rows":["nom","gen","dat","acc","abl"],"cols":["sing.","plural"]},"cells":{}}}

Rules:
- Create exactly ${n} activities.
- Every activity MUST include targets[] listing the weak skills it practices.
- Only lemmas: ${args.lesson.allowList.lemmas.join(", ") || "(lesson-appropriate English or listed Latin)"}
- Only constructions: ${args.lesson.allowList.constructions.join(", ") || "lesson grammar"}
- Unique ids starting with gen-
- For English POS drills, mark the target word with **bold** markers in labels.
- Classical Latin when using Latin. Macrons optional in accept lists.
- Do NOT generate activities for skills already mastered if focus lists weak skills.`;

  const raw = await complete({
    model: modelFor("generate"),
    system,
    messages: [
      {
        role: "user",
        content: `Lesson: ${args.lesson.title}\nStandard: ${args.lesson.standardSummary}\nTeach (excerpt):\n${args.lesson.teach.slice(0, 1200)}\n\nGenerate ${n} TARGETED activities as JSON.`,
      },
    ],
    maxTokens: 3500,
    reasoning: REASONING_OFF,
  });

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    console.error("generateActivities: bad JSON", raw.slice(0, 400));
    return [];
  }

  const list = generatedListSchema.safeParse(parsed);
  if (!list.success) return [];

  const out: Activity[] = [];
  for (const item of list.data.activities) {
    const a = activitySchema.safeParse({
      ...(item as object),
      source: "generated",
    });
    if (!a.success) {
      console.warn("drop invalid activity", a.error.issues);
      continue;
    }
    if (
      args.lesson.allowList.activityTypes.length &&
      !args.lesson.allowList.activityTypes.includes(a.data.type)
    ) {
      continue;
    }
    // Prefer items that hit weak skills when we have them
    if (args.focus.weakSkills.length && a.data.targets?.length) {
      const hits = a.data.targets.some((t) =>
        args.focus.weakSkills.some(
          (w) =>
            t.toLowerCase().includes(w.toLowerCase()) ||
            w.toLowerCase().includes(t.toLowerCase())
        )
      );
      if (!hits) {
        // still allow if nothing else — push with lower priority by continuing only if empty
        // drop off-target AI items
        continue;
      }
    }
    out.push(expandFromPattern(a.data));
  }
  return out;
}
