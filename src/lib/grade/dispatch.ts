import type {
  Activity,
  GradeResult,
  MultipleChoicePayload,
  ParadigmGridPayload,
  SingleFormPayload,
  TranslatePayload,
  ShortAnswerPayload,
} from "@/types/activity";
import { matchesAny, normalizeLatin } from "@/lib/normalize";
import { gradeWithAi } from "@/lib/ai/grade";

export type GradeContext = {
  lessonTitle: string;
  teach: string;
  standardSummary: string;
  attemptNumber: number;
};

export async function gradeActivity(
  activity: Activity,
  response: unknown,
  ctx: GradeContext
): Promise<GradeResult> {
  switch (activity.type) {
    case "paradigm_grid":
      return gradeParadigmGrid(
        activity.payload as ParadigmGridPayload,
        response
      );
    case "single_form":
      return gradeSingleForm(activity.payload as SingleFormPayload, response);
    case "multiple_choice":
      return gradeMultipleChoice(
        activity.payload as MultipleChoicePayload,
        response
      );
    case "translate":
      return gradeWithAi({
        activity,
        response,
        ctx,
        kind: "translate",
        payload: activity.payload as TranslatePayload,
      });
    case "short_answer":
      return gradeWithAi({
        activity,
        response,
        ctx,
        kind: "short_answer",
        payload: activity.payload as ShortAnswerPayload,
      });
    default:
      return {
        status: "pending",
        feedback: "Unknown activity type.",
      };
  }
}

function asRecord(response: unknown): Record<string, string> {
  if (!response || typeof response !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(response as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function gradeParadigmGrid(
  payload: ParadigmGridPayload,
  response: unknown
): GradeResult {
  const answers = asRecord(response);
  const cellResults: Record<string, boolean> = {};
  let correct = 0;
  let total = 0;

  for (const [cellId, accepted] of Object.entries(payload.cells)) {
    if (payload.prefill && cellId in payload.prefill) continue;
    total += 1;
    const given = answers[cellId] ?? "";
    const ok = matchesAny(given, accepted, "latin");
    cellResults[cellId] = ok;
    if (ok) correct += 1;
  }

  if (total === 0) {
    return { status: "passed", feedback: "Nothing to fill.", cellResults };
  }

  if (correct === total) {
    return {
      status: "passed",
      feedback: "All forms look good — nice work.",
      cellResults,
    };
  }

  if (correct / total >= 0.6) {
    const wrong = Object.entries(cellResults)
      .filter(([, ok]) => !ok)
      .map(([id]) => id)
      .slice(0, 5);
    return {
      status: "partial",
      feedback: `You have ${correct}/${total} correct. Check: ${wrong.join(", ")}. Watch the endings carefully.`,
      issues: ["endings"],
      cellResults,
    };
  }

  return {
    status: "pending",
    feedback: `Only ${correct}/${total} correct. Review the paradigm chart in the lesson, then try again.`,
    issues: ["endings", "paradigm"],
    cellResults,
  };
}

function gradeSingleForm(
  payload: SingleFormPayload,
  response: unknown
): GradeResult {
  const text =
    typeof response === "string"
      ? response
      : typeof response === "object" &&
          response &&
          "text" in response &&
          typeof (response as { text: unknown }).text === "string"
        ? (response as { text: string }).text
        : "";

  if (matchesAny(text, payload.accept, "latin")) {
    return { status: "passed", feedback: "Correct." };
  }

  const close = payload.accept.some(
    (a) =>
      normalizeLatin(text).length > 0 &&
      (normalizeLatin(a).startsWith(normalizeLatin(text)) ||
        normalizeLatin(text).startsWith(normalizeLatin(a).slice(0, 3)))
  );

  if (close) {
    return {
      status: "partial",
      feedback: "Close — check the ending (and spelling) once more.",
      issues: ["ending"],
    };
  }

  return {
    status: "pending",
    feedback: payload.hint
      ? `Not quite. Hint: ${payload.hint}`
      : "Not quite. Check case/number (or person) and try again.",
    issues: ["form"],
  };
}

function gradeMultipleChoice(
  payload: MultipleChoicePayload,
  response: unknown
): GradeResult {
  const optionId =
    typeof response === "string"
      ? response
      : typeof response === "object" &&
          response &&
          "optionId" in response &&
          typeof (response as { optionId: unknown }).optionId === "string"
        ? (response as { optionId: string }).optionId
        : "";

  if (optionId === payload.correctOptionId) {
    return { status: "passed", feedback: "Correct." };
  }
  return {
    status: "pending",
    feedback: "Not the right choice — re-read the question and try again.",
    issues: ["concept"],
  };
}
