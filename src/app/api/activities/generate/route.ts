import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { generatedActivities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/content";
import { generateActivities } from "@/lib/ai/generate";
import { expandFromPattern } from "@/lib/activities/templates";
import { recomputeStandard } from "@/lib/standard";
import type { Activity } from "@/types/activity";

const bodySchema = z.object({
  lessonSlug: z.string().min(1),
  issues: z.array(z.string()).optional(),
});

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

  const { lessonSlug, issues } = parsed.data;
  const lesson = loadLessonBySlug(lessonSlug);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const genRows = await db
    .select()
    .from(generatedActivities)
    .where(
      and(
        eq(generatedActivities.userId, session.user.id),
        eq(generatedActivities.lessonSlug, lessonSlug)
      )
    );

  const max = Number(process.env.GENERATION_MAX_PER_LESSON ?? 12);
  if (genRows.length >= max) {
    return NextResponse.json(
      {
        error: `Practice limit reached for this lesson (${max}). Use the tutor chat or ask your teacher.`,
        activities: [],
      },
      { status: 429 }
    );
  }

  const generated: Activity[] = genRows.map((r) =>
    expandFromPattern(r.activity as Activity)
  );
  const allActivities = [...lesson.seeds, ...generated];
  const progress = await recomputeStandard(
    session.user.id,
    lesson,
    allActivities
  );

  if (progress.met) {
    return NextResponse.json({
      activities: [],
      standardMet: true,
      message: "Standard already met — no more practice needed.",
    });
  }

  const remaining = progress.requirements
    .filter((r) => !r.met)
    .map((r) => r.detail)
    .join("; ");

  let activities: Activity[] = [];
  try {
    activities = await generateActivities({
      lesson,
      remainingSummary: remaining,
      recentIssues: issues ?? [],
      count: 2,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 502 }
    );
  }

  const room = max - genRows.length;
  activities = activities.slice(0, room).map((a) => ({
    ...a,
    id: a.id.startsWith("gen-")
      ? `${a.id}-${crypto.randomUUID().slice(0, 8)}`
      : `gen-${crypto.randomUUID().slice(0, 8)}`,
    source: "generated" as const,
  }));

  for (const a of activities) {
    await db.insert(generatedActivities).values({
      userId: session.user.id,
      lessonSlug,
      activity: a,
    });
  }

  return NextResponse.json({
    activities,
    standardMet: false,
    generatedTotal: genRows.length + activities.length,
    max,
  });
}
