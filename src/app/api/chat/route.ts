import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, generatedActivities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/content";
import { tutorReply } from "@/lib/ai/tutor";
import { expandFromPattern } from "@/lib/activities/templates";
import { recomputeStandard } from "@/lib/standard";
import type { Activity } from "@/types/activity";

const bodySchema = z.object({
  lessonSlug: z.string().min(1),
  message: z.string().min(1).max(4000),
});

const MAX_HISTORY = 20;

export async function POST(request: Request) {
  const { session, error } = await requireUser();
  if (!session) return error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { lessonSlug, message } = parsed.data;
  const lesson = loadLessonBySlug(lessonSlug);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const historyRows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, session.user.id),
        eq(chatMessages.lessonSlug, lessonSlug)
      )
    )
    .orderBy(asc(chatMessages.createdAt));

  const history = historyRows.slice(-MAX_HISTORY).map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));

  const genRows = await db
    .select()
    .from(generatedActivities)
    .where(
      and(
        eq(generatedActivities.userId, session.user.id),
        eq(generatedActivities.lessonSlug, lessonSlug)
      )
    );
  const generated = genRows.map((r) =>
    expandFromPattern(r.activity as Activity)
  );
  const progress = await recomputeStandard(session.user.id, lesson, [
    ...lesson.seeds,
    ...generated,
  ]);
  const progressNote = progress.requirements
    .map((r) => `${r.met ? "✓" : "○"} ${r.detail}`)
    .join(" | ");

  let reply: string;
  try {
    reply = await tutorReply({
      lesson,
      history,
      userMessage: message,
      progressNote,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tutor unavailable" },
      { status: 502 }
    );
  }

  const [userMsg] = await db
    .insert(chatMessages)
    .values({
      userId: session.user.id,
      lessonSlug,
      role: "user",
      content: message,
    })
    .returning();

  const [assistantMsg] = await db
    .insert(chatMessages)
    .values({
      userId: session.user.id,
      lessonSlug,
      role: "assistant",
      content: reply,
    })
    .returning();

  return NextResponse.json({
    userMessage: {
      id: userMsg!.id,
      role: "user",
      content: userMsg!.content,
    },
    assistantMessage: {
      id: assistantMsg!.id,
      role: "assistant",
      content: assistantMsg!.content,
    },
  });
}
