import { z } from "zod";

export const answerStatusSchema = z.enum(["pending", "partial", "passed"]);
export type AnswerStatus = z.infer<typeof answerStatusSchema>;

export const activityTypeSchema = z.enum([
  "paradigm_grid",
  "single_form",
  "translate",
  "multiple_choice",
  "short_answer",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const paradigmGridPayloadSchema = z.object({
  kind: z.enum(["noun", "adjective", "verb"]).default("noun"),
  lemma: z.string(),
  stem: z.string().optional(),
  mode: z.enum(["full_form", "ending_only"]).default("full_form"),
  /** Optional template id, e.g. first_declension */
  pattern: z.string().optional(),
  labels: z.object({
    rows: z.array(z.string()),
    cols: z.array(z.string()),
  }),
  /** cellId → accepted answers */
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

export const activitySchema = z.object({
  id: z.string(),
  type: activityTypeSchema,
  source: z.enum(["seed", "generated"]).default("seed"),
  prompt: z.string().optional(),
  targets: z.array(z.string()).optional(),
  required: z.boolean().default(true),
  payload: z.union([
    paradigmGridPayloadSchema,
    singleFormPayloadSchema,
    translatePayloadSchema,
    multipleChoicePayloadSchema,
    shortAnswerPayloadSchema,
  ]),
});
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
  /** For paradigm grids: cellId → correct? */
  cellResults?: Record<string, boolean>;
};
