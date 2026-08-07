import type {
  Activity,
  GradeResult,
  MultipleChoicePayload,
  ParadigmGridPayload,
  SingleFormPayload,
  TranslatePayload,
  ShortAnswerPayload,
  MatchingPayload,
  OrderingPayload,
  MultiSelectPayload,
  ClozePayload,
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
    case "matching":
      return gradeMatching(activity.payload as MatchingPayload, response);
    case "ordering":
      return gradeOrdering(activity.payload as OrderingPayload, response);
    case "multi_select":
      return gradeMultiSelect(activity.payload as MultiSelectPayload, response);
    case "cloze":
      return gradeCloze(activity.payload as ClozePayload, response);
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

function scoreRatio(
  correct: number,
  total: number,
  cellResults?: Record<string, boolean>
): GradeResult {
  if (total === 0) {
    return { status: "passed", feedback: "Nothing to check.", cellResults };
  }
  if (correct === total) {
    return {
      status: "passed",
      feedback: "All correct — nice work.",
      cellResults,
    };
  }
  if (correct / total >= 0.6) {
    return {
      status: "partial",
      feedback: `You have ${correct}/${total} correct. Fix the rest and check again.`,
      issues: ["partial"],
      cellResults,
    };
  }
  return {
    status: "pending",
    feedback: `Only ${correct}/${total} correct. Review the lesson and try again.`,
    issues: ["review"],
    cellResults,
  };
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

/** response: { pairs: Record<leftId, rightId> } */
function gradeMatching(
  payload: MatchingPayload,
  response: unknown
): GradeResult {
  if (!Array.isArray(payload.left) || !payload.pairs) {
    return {
      status: "pending",
      feedback: "This matching activity is misconfigured (missing pairs).",
    };
  }

  const pairs =
    response &&
    typeof response === "object" &&
    "pairs" in response &&
    typeof (response as { pairs: unknown }).pairs === "object" &&
    (response as { pairs: unknown }).pairs
      ? ((response as { pairs: Record<string, string> }).pairs ?? {})
      : asRecord(response);

  const cellResults: Record<string, boolean> = {};
  let correct = 0;
  const leftIds = payload.left.map((l) => l.id);

  for (const leftId of leftIds) {
    const want = payload.pairs[leftId];
    const got = pairs[leftId] ?? "";
    const ok = want === got;
    cellResults[leftId] = ok;
    if (ok) correct += 1;
  }

  return scoreRatio(correct, leftIds.length, cellResults);
}

/** response: { order: string[] } */
function gradeOrdering(
  payload: OrderingPayload,
  response: unknown
): GradeResult {
  let order: string[] = [];
  if (
    response &&
    typeof response === "object" &&
    "order" in response &&
    Array.isArray((response as { order: unknown }).order)
  ) {
    order = (response as { order: string[] }).order.map(String);
  }

  const want = payload.correctOrder;
  if (order.length !== want.length) {
    return {
      status: "pending",
      feedback: "Put every item in the list, then check again.",
      issues: ["order"],
    };
  }

  let correct = 0;
  const cellResults: Record<string, boolean> = {};
  for (let i = 0; i < want.length; i++) {
    const ok = order[i] === want[i];
    cellResults[want[i]!] = ok;
    if (ok) correct += 1;
  }

  if (correct === want.length) {
    return { status: "passed", feedback: "Order is correct.", cellResults };
  }
  if (correct / want.length >= 0.5) {
    return {
      status: "partial",
      feedback: `${correct}/${want.length} positions are right. Shift a few items.`,
      issues: ["order"],
      cellResults,
    };
  }
  return {
    status: "pending",
    feedback: "Order is off — think about the sequence from the lesson.",
    issues: ["order"],
    cellResults,
  };
}

/** response: { optionIds: string[] } */
function gradeMultiSelect(
  payload: MultiSelectPayload,
  response: unknown
): GradeResult {
  let selected: string[] = [];
  if (
    response &&
    typeof response === "object" &&
    "optionIds" in response &&
    Array.isArray((response as { optionIds: unknown }).optionIds)
  ) {
    selected = (response as { optionIds: string[] }).optionIds.map(String);
  }

  const want = new Set(payload.correctOptionIds);
  const got = new Set(selected);

  if (got.size === 0) {
    return {
      status: "pending",
      feedback: "Select at least one option.",
      issues: ["multi_select"],
    };
  }

  let truePos = 0;
  for (const id of got) {
    if (want.has(id)) truePos += 1;
  }
  const falsePos = [...got].filter((id) => !want.has(id)).length;
  const falseNeg = [...want].filter((id) => !got.has(id)).length;

  if (falsePos === 0 && falseNeg === 0) {
    return { status: "passed", feedback: "All correct selections." };
  }
  if (truePos > 0 && falsePos + falseNeg <= 1) {
    return {
      status: "partial",
      feedback:
        "Almost — you have some right, but something is missing or extra.",
      issues: ["multi_select"],
    };
  }
  return {
    status: "pending",
    feedback: "Not quite — select every correct option and only those.",
    issues: ["multi_select"],
  };
}

/** response: { blanks: Record<id, string> } */
function gradeCloze(payload: ClozePayload, response: unknown): GradeResult {
  const blanks =
    response &&
    typeof response === "object" &&
    "blanks" in response &&
    typeof (response as { blanks: unknown }).blanks === "object" &&
    (response as { blanks: unknown }).blanks
      ? ((response as { blanks: Record<string, string> }).blanks ?? {})
      : asRecord(response);

  const cellResults: Record<string, boolean> = {};
  let correct = 0;
  const ids = Object.keys(payload.blanks);

  for (const id of ids) {
    const accepted = payload.blanks[id] ?? [];
    const given = blanks[id] ?? "";
    const ok = matchesAny(given, accepted, "latin");
    cellResults[id] = ok;
    if (ok) correct += 1;
  }

  const result = scoreRatio(correct, ids.length, cellResults);
  if (result.status === "passed") {
    result.feedback = "All blanks look good.";
  } else if (result.status === "partial") {
    result.feedback = `You have ${correct}/${ids.length} blanks correct.`;
    result.issues = ["cloze"];
  } else {
    result.issues = ["cloze"];
  }
  return result;
}
