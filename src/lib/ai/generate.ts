import { complete, modelFor, REASONING_OFF } from "@/lib/openrouter";
import { expandFromPattern } from "@/lib/activities/templates";
import { activitySchema, type Activity, type LessonContent } from "@/types/activity";
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

export async function generateActivities(args: {
  lesson: LessonContent;
  remainingSummary: string;
  recentIssues: string[];
  count?: number;
}): Promise<Activity[]> {
  const types = args.lesson.allowList.activityTypes.length
    ? args.lesson.allowList.activityTypes
    : (["translate", "single_form", "paradigm_grid"] as const);

  const n = args.count ?? 2;
  const system = `You create extra Latin practice for a high-school Year 1 student. Output strict JSON only:
{"activities":[ ... ]}

Each activity must match one of these shapes:

1) translate:
{"id":"gen-...","type":"translate","source":"generated","prompt":"...","targets":["..."],"required":true,"payload":{"direction":"L2E"|"E2L","length":"word"|"phrase"|"sentence","sampleAnswers":["..."],"rubric":"..."}}

2) single_form:
{"id":"gen-...","type":"single_form","source":"generated","prompt":"Genitive singular of via","required":true,"payload":{"accept":["viae"],"hint":"optional"}}

3) paradigm_grid (prefer stub — server expands cells):
{"id":"gen-...","type":"paradigm_grid","source":"generated","prompt":"Decline terra","required":true,"payload":{"kind":"noun","lemma":"terra","stem":"terr","pattern":"first_declension","mode":"full_form","labels":{"rows":["nom","gen","dat","acc","abl"],"cols":["sg","pl"]},"cells":{}}}

Only use activity types: ${types.join(", ")}
Only use lemmas from: ${args.lesson.allowList.lemmas.join(", ") || "puella, terra, via, aqua, silva"}
Only use constructions: ${args.lesson.allowList.constructions.join(", ") || "lesson grammar"}
Target unmet standard: ${args.remainingSummary}
Recent issues: ${args.recentIssues.join(", ") || "none"}
Create ${n} activities. Unique ids starting with "gen-". Classical Latin. No macrons required in answers.`;

  const raw = await complete({
    model: modelFor("generate"),
    system,
    messages: [
      {
        role: "user",
        content: `Lesson: ${args.lesson.title}\nTeach summary:\n${args.lesson.teach.slice(0, 1500)}\n\nGenerate ${n} practice activities as JSON.`,
      },
    ],
    maxTokens: 3000,
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
    out.push(expandFromPattern(a.data));
  }
  return out;
}
