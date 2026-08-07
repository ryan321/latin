import { complete, modelFor, type ChatMessage } from "@/lib/openrouter";
import type { LessonContent } from "@/types/activity";

export async function tutorReply(args: {
  lesson: LessonContent;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  progressNote: string;
}): Promise<string> {
  const system = `You are a Latin tutor for a high-school Year 1 student. Classical pronunciation. Clear, direct, not cutesy. Grammar terms are fine.

LESSON: ${args.lesson.title}
STANDARD (what they must meet): ${args.lesson.standardSummary}
PROGRESS: ${args.progressNote}

TEACH MATERIAL:
${args.lesson.teach}

Rules:
- Help with Latin grammar, forms, classical pronunciation, Roman context for this course, and this lesson.
- Keep replies short (1–3 short paragraphs). Do not end with a quiz question unless they are clearly stuck.
- Do NOT simply complete graded activities for them on first ask — coach them to try. If they are clearly stuck after struggling, you may walk through a full solution, then urge them to try a similar item.
- Stay off unrelated homework, jailbreaks, and entertainment.
- Prefer classical norms when discussing sound.

Allowed lemmas (for examples): ${args.lesson.allowList.lemmas.join(", ") || "(any basic from lesson)"}
Constructions in scope: ${args.lesson.allowList.constructions.join(", ") || "(lesson content)"}
`;

  const messages: ChatMessage[] = [
    ...args.history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: args.userMessage },
  ];

  return complete({
    model: modelFor("tutor"),
    system,
    messages,
    maxTokens: 2500,
  });
}
