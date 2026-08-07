import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { attempts, generatedActivities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLessonBySlug, resolveActivity } from "@/lib/content";
import { gradeActivity } from "@/lib/grade/dispatch";
import { recomputeStandard } from "@/lib/standard";
import { expandFromPattern } from "@/lib/activities/templates";
import type { Activity } from "@/types/activity";

const bodySchema = z.object({
  lessonSlug: z.string().min(1),
  activityId: z.string().min(1),
  response: z.unknown(),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }

  const { lessonSlug, activityId, response } = parsed.data;
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

  const generated: Activity[] = genRows.map((r) =>
    expandFromPattern(r.activity as Activity)
  );

  const activity = resolveActivity(lesson, activityId, generated);
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const [{ value: priorCount }] = await db
    .select({ value: count() })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, session.user.id),
        eq(attempts.activityId, activityId)
      )
    );

  const attemptNumber = Number(priorCount) + 1;

  const result = await gradeActivity(activity, response, {
    lessonTitle: lesson.title,
    teach: lesson.teach,
    standardSummary: lesson.standardSummary,
    attemptNumber,
  });

  await db.insert(attempts).values({
    userId: session.user.id,
    lessonSlug,
    activityId,
    response,
    status: result.status,
    feedback: result.feedback,
    issues: result.issues ?? [],
    attemptNumber,
  });

  const allActivities = [...lesson.seeds, ...generated];
  const progress = await recomputeStandard(
    session.user.id,
    lesson,
    allActivities
  );

  return NextResponse.json({
    status: result.status,
    feedback: result.feedback,
    issues: result.issues ?? [],
    cellResults: result.cellResults,
    attemptNumber,
    standardMet: progress.met,
    progress,
  });
}
