import {
  complete,
  modelFor,
  REASONING_OFF,
} from "@/lib/openrouter";
import type {
  Activity,
  GradeResult,
  ShortAnswerPayload,
  TranslatePayload,
  AnswerStatus,
} from "@/types/activity";
import type { GradeContext } from "@/lib/grade/dispatch";

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

export async function gradeWithAi(args: {
  activity: Activity;
  response: unknown;
  ctx: GradeContext;
  kind: "translate" | "short_answer";
  payload: TranslatePayload | ShortAnswerPayload;
}): Promise<GradeResult> {
  const text =
    typeof args.response === "string"
      ? args.response
      : typeof args.response === "object" &&
          args.response &&
          "text" in args.response
        ? String((args.response as { text: unknown }).text ?? "")
        : JSON.stringify(args.response);

  if (!text.trim()) {
    return {
      status: "pending",
      feedback: "Write an answer first, then check.",
    };
  }

  const samples =
    "sampleAnswers" in args.payload
      ? args.payload.sampleAnswers
      : [];
  const rubric =
    "rubric" in args.payload ? args.payload.rubric : undefined;

  const direction =
    args.kind === "translate"
      ? (args.payload as TranslatePayload).direction
      : null;
  const length =
    args.kind === "translate"
      ? (args.payload as TranslatePayload).length
      : null;

  const system = `You grade free-response answers for a Year 1 high-school Latin course (classical pronunciation, Henle-inspired grammar). Be fair and encouraging, but honest.

Output strict JSON only:
{"status":"passed"|"partial"|"pending","feedback":"<1-3 sentences>","issues":["optional","tags"]}

Status:
- passed: meaning and required forms are good enough (accept reasonable variants; macrons optional; English synonyms OK for L2E; Latin word order flexible if forms/meaning are right for E2L).
- partial: on track but missing something important or has a fixable form error.
- pending: off-base, blank-ish, or wrong target.

Feedback rules:
- Address the student as "you".
- Name the grammar issue when relevant (case, agreement, tense, vocab).
- On first fails (attempt ${args.ctx.attemptNumber}): hint; do NOT dump the full model answer unless attempt >= 3.
- Never invent that they passed if the core answer is wrong.

Lesson: ${args.ctx.lessonTitle}
Standard: ${args.ctx.standardSummary}
`;

  const userPrompt = `ACTIVITY TYPE: ${args.kind}
${direction ? `DIRECTION: ${direction} (${direction === "L2E" ? "Latin to English" : "English to Latin"})` : ""}
${length ? `LENGTH: ${length}` : ""}
PROMPT: ${args.activity.prompt ?? ""}
${rubric ? `RUBRIC: ${rubric}` : ""}
${samples.length ? `SAMPLE ACCEPTABLE ANSWERS:\n${samples.map((s) => `- ${s}`).join("\n")}` : ""}

STUDENT ANSWER:
${text}

Respond with JSON only.`;

  try {
    const raw = await complete({
      model: modelFor("grader"),
      system,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 2000,
      reasoning: REASONING_OFF,
    });

    const parsed = extractJson(raw) as {
      status?: unknown;
      feedback?: unknown;
      issues?: unknown;
    };

    const status: AnswerStatus =
      parsed.status === "passed" ||
      parsed.status === "partial" ||
      parsed.status === "pending"
        ? parsed.status
        : "pending";

    const feedback =
      typeof parsed.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : "Take another look and try again.";

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((x): x is string => typeof x === "string")
      : [];

    return { status, feedback, issues };
  } catch (err) {
    console.error("AI grade failed", err);
    return {
      status: "pending",
      feedback:
        "The grader had trouble just now — check your connection/API key, or try again in a moment.",
    };
  }
}
