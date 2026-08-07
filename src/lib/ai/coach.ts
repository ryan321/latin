import { complete, modelFor, REASONING_OFF } from "@/lib/openrouter";
import type { LessonContent } from "@/types/activity";
import type { RemediationFocus } from "@/lib/activities/remediate";
import type { ProgressSnapshot } from "@/lib/standard";

/**
 * Encouraging, targeted coaching after the main (seed) practice set.
 * Template fallback if no API key / AI fails.
 */
export async function writeRemediationCoach(args: {
  lesson: LessonContent;
  progress: ProgressSnapshot;
  focus: RemediationFocus;
  phase: "after_seeds" | "after_extra";
}): Promise<string> {
  if (args.progress.met) {
    return (
      `**Well done — you've met the standard for this lesson.**\n\n` +
      `You showed what this lesson asked for: ${args.lesson.standardSummary}\n\n` +
      `You're ready for the next lesson when you are.`
    );
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await writeCoachWithAi(args);
    } catch (err) {
      console.error("coach AI failed", err);
    }
  }
  return writeCoachTemplate(args);
}

async function writeCoachWithAi(args: {
  lesson: LessonContent;
  progress: ProgressSnapshot;
  focus: RemediationFocus;
  phase: "after_seeds" | "after_extra";
}): Promise<string> {
  const unmet = args.progress.requirements
    .filter((r) => !r.met)
    .map((r) => r.detail)
    .join("; ");

  const system = `You are a warm, clear high-school Latin coach (classical Latin course).
Write a short coaching message in Markdown after the student finished the main practice set.

Tone:
- Start with genuine encouragement ("Good job…" / "Nice work getting through these…")
- Then: there are a few things that still need practice (be specific)
- Teach briefly: 2–4 short bullets or mini-paragraphs of re-instruction on ONLY the weak points
- End by introducing a few more practice questions that will appear below
- Do NOT say they failed or use harsh grades
- Do NOT unlock the lesson or claim the standard is met if it is not
- Keep total length roughly 120–220 words
- No JSON, no code fences around the whole message

Lesson: ${args.lesson.title}
Standard: ${args.lesson.standardSummary}
Unmet checklist: ${unmet || "some items"}
Weak skills: ${args.focus.weakSkills.join(", ") || "general"}
Recent issues: ${args.focus.recentIssues.join(", ") || "none"}
Phase: ${args.phase}
Teach excerpt for accurate content:
${args.lesson.teach.slice(0, 1400)}
`;

  const text = await complete({
    model: modelFor("tutor"),
    system,
    messages: [
      {
        role: "user",
        content:
          "Write the coaching message now. Start with encouragement, then micro-instruction, then invite the extra practice.",
      },
    ],
    maxTokens: 1200,
    reasoning: REASONING_OFF,
  });
  return text.trim();
}

function writeCoachTemplate(args: {
  lesson: LessonContent;
  progress: ProgressSnapshot;
  focus: RemediationFocus;
  phase: "after_seeds" | "after_extra";
}): string {
  const skills =
    args.focus.weakSkills.length > 0
      ? args.focus.weakSkills
      : args.focus.unmetDetails.slice(0, 4);

  const skillList = skills.map((s) => `- **${s}**`).join("\n");

  const reminders = buildSkillReminders(args.focus.weakSkills, args.lesson);

  const head =
    args.phase === "after_extra"
      ? "Good effort on that extra set — you're getting closer."
      : "Good job working through the main questions.";

  return (
    `**${head}** There are still a few things that need a little more practice before this lesson’s standard is fully met.\n\n` +
    `### What to tighten up\n\n` +
    (skillList || "- A few checklist items are still open") +
    `\n\n` +
    `### Quick reminders\n\n` +
    reminders +
    `\n\n` +
    `### Next\n\n` +
    `Here are a few more questions aimed at those weak spots. Work through them, then we'll check the standard again.`
  );
}

function buildSkillReminders(skills: string[], lesson: LessonContent): string {
  const tips: string[] = [];
  const s = skills.map((x) => x.toLowerCase());

  const add = (cond: boolean, tip: string) => {
    if (cond) tips.push(tip);
  };

  add(
    s.some((x) => x.includes("noun")),
    "A **noun** names a person, place, thing, or idea (girl, Rome, water, peace)."
  );
  add(
    s.some((x) => x.includes("verb")),
    "A **verb** shows action or being (carries, is, are, march)."
  );
  add(
    s.some((x) => x.includes("adjective")),
    "An **adjective** describes a noun (large, cold, brave)."
  );
  add(
    s.some((x) => x.includes("preposition")),
    "A **preposition** relates a noun to the sentence (in, with, from, into)."
  );
  add(
    s.some((x) => x.includes("nominative")),
    "**Nominative** = subject — who/what does the action or is something."
  );
  add(
    s.some((x) => x.includes("accusative")),
    "**Accusative** = direct object — whom/what receives the action."
  );
  add(
    s.some((x) => x.includes("genitive")),
    "**Genitive** ≈ of / possession (the girl’s water)."
  );
  add(
    s.some((x) => x.includes("dative")),
    "**Dative** ≈ to / for (gives water *to the girl*)."
  );
  add(
    s.some((x) => x.includes("ablative")),
    "**Ablative** often = by/with/from, or place where after *in*."
  );
  add(
    s.some((x) => x.includes("case")),
    "**Case** is the form of a noun that shows its job — Latin uses endings, not only word order."
  );

  if (tips.length === 0) {
    tips.push(
      `Re-read the lesson idea: ${lesson.standardSummary}`,
      "Slow down on each item: what job is this word doing in the sentence?"
    );
  }

  return tips.map((t) => `- ${t}`).join("\n");
}
