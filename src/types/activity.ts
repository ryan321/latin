import { z } from "zod";

export const answerStatusSchema = z.enum(["pending", "partial", "passed"]);
export type AnswerStatus = z.infer<typeof answerStatusSchema>;

export const activityTypeSchema = z.enum([
  "paradigm_grid",
  "single_form",
  "translate",
  "multiple_choice",
  "short_answer",
  /** Match left prompts to right labels (dropdown per left item). */
  "matching",
  /** Put items in the correct sequence. */
  "ordering",
  /** Select all correct options (one or more). */
  "multi_select",
  /** Fill blanks in a sentence; optional word bank. */
  "cloze",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const paradigmGridPayloadSchema = z.object({
  kind: z.enum(["noun", "adjective", "verb"]).default("noun"),
  lemma: z.string(),
  stem: z.string().optional(),
  mode: z.enum(["full_form", "ending_only"]).default("full_form"),
  pattern: z.string().optional(),
  labels: z.object({
    rows: z.array(z.string()),
    cols: z.array(z.string()),
  }),
  cells: z.record(z.string(), z.array(z.string())),
  prefill: z.record(z.string(), z.string()).optional(),
});
export type ParadigmGridPayload = z.infer<typeof paradigmGridPayloadSchema>;

export const singleFormPayloadSchema = z.object({
  accept: z.array(z.string()).min(1),
  hint: z.string().optional(),
});
export type SingleFormPayload = z.infer<typeof singleFormPayloadSchema>;

export const translatePayloadSchema = z.object({
  direction: z.enum(["L2E", "E2L"]),
  length: z.enum(["word", "phrase", "sentence"]).default("sentence"),
  sampleAnswers: z.array(z.string()).default([]),
  rubric: z.string().optional(),
});
export type TranslatePayload = z.infer<typeof translatePayloadSchema>;

export const multipleChoicePayloadSchema = z.object({
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  correctOptionId: z.string(),
});
export type MultipleChoicePayload = z.infer<typeof multipleChoicePayloadSchema>;

export const shortAnswerPayloadSchema = z.object({
  sampleAnswers: z.array(z.string()).default([]),
  rubric: z.string().optional(),
});
export type ShortAnswerPayload = z.infer<typeof shortAnswerPayloadSchema>;

/** left id → correct right id */
export const matchingPayloadSchema = z.object({
  left: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  right: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  /** Map leftId → rightId */
  pairs: z.record(z.string(), z.string()),
  leftLabel: z.string().optional(),
  rightLabel: z.string().optional(),
});
export type MatchingPayload = z.infer<typeof matchingPayloadSchema>;

export const orderingPayloadSchema = z.object({
  /** Items shown shuffled to the student */
  items: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  /** Correct order of item ids */
  correctOrder: z.array(z.string()).min(2),
});
export type OrderingPayload = z.infer<typeof orderingPayloadSchema>;

export const multiSelectPayloadSchema = z.object({
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  correctOptionIds: z.array(z.string()).min(1),
});
export type MultiSelectPayload = z.infer<typeof multiSelectPayloadSchema>;

export const clozePayloadSchema = z.object({
  /**
   * Template with blanks as {{1}}, {{2}}, …
   * e.g. "Puella {{1}} villā {{2}}."
   */
  template: z.string(),
  /** blank id ("1") → accepted answers */
  blanks: z.record(z.string(), z.array(z.string())),
  /** Optional bank of words shown as chips */
  wordBank: z.array(z.string()).optional(),
});
export type ClozePayload = z.infer<typeof clozePayloadSchema>;

/** Discriminated by type so payload shape is validated correctly (z.union was fragile). */
export const activitySchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("paradigm_grid"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: paradigmGridPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("single_form"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: singleFormPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("translate"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: translatePayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("multiple_choice"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: multipleChoicePayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("short_answer"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: shortAnswerPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("matching"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: matchingPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("ordering"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: orderingPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("multi_select"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: multiSelectPayloadSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("cloze"),
    source: z.enum(["seed", "generated"]).default("seed"),
    prompt: z.string().optional(),
    targets: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    payload: clozePayloadSchema,
  }),
]);
export type Activity = z.infer<typeof activitySchema>;

export const standardRequirementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("activity_passed"),
    activityId: z.string(),
  }),
  z.object({
    type: z.literal("count"),
    activityType: activityTypeSchema,
    n: z.number().int().positive(),
  }),
  /** Count distinct passed activities whose targets[] include this skill tag. */
  z.object({
    type: z.literal("skill_count"),
    skill: z.string(),
    n: z.number().int().positive(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal("translate_count"),
    direction: z.enum(["L2E", "E2L"]).optional(),
    length: z.enum(["word", "phrase", "sentence"]).optional(),
    n: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("paradigm_mastery"),
    n: z.number().int().positive().default(1),
  }),
]);
export type StandardRequirement = z.infer<typeof standardRequirementSchema>;

export const lessonContentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  unitSlug: z.string(),
  order: z.number().int(),
  standardSummary: z.string(),
  standard: z.object({
    requirements: z.array(standardRequirementSchema),
  }),
  teach: z.string(),
  allowList: z.object({
    lemmas: z.array(z.string()).default([]),
    constructions: z.array(z.string()).default([]),
    activityTypes: z.array(activityTypeSchema).default([]),
  }),
  seeds: z.array(activitySchema),
});
export type LessonContent = z.infer<typeof lessonContentSchema>;

export const unitContentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  order: z.number().int(),
  summary: z.string().optional(),
});
export type UnitContent = z.infer<typeof unitContentSchema>;

export type GradeResult = {
  status: AnswerStatus;
  feedback: string;
  issues?: string[];
  cellResults?: Record<string, boolean>;
};
