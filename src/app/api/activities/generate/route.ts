import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { generatedActivities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/content";
import { generateTargetedPractice } from "@/lib/ai/generate";
import { expandFromPattern } from "@/lib/activities/templates";
import {
  collectRemediationFocus,
  loadLatestAttempts,
  recomputeStandard,
} from "@/lib/standard";
import type { Activity } from "@/types/activity";

const bodySchema = z.object({
  lessonSlug: z.string().min(1),
  /** Optional client-provided issues from last grade */
  issues: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(6).optional(),
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

  const { lessonSlug, issues, count } = parsed.data;
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

  const max = Number(process.env.GENERATION_MAX_PER_LESSON ?? 24);
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
      progress,
    });
  }

  const rows = await loadLatestAttempts(session.user.id, lessonSlug);
  const focus = collectRemediationFocus(progress, allActivities, rows);
  if (issues?.length) {
    for (const i of issues) {
      if (i && !focus.recentIssues.includes(i)) focus.recentIssues.push(i);
    }
  }

  const room = max - genRows.length;
  const want = Math.min(count ?? 3, room);

  let activities: Activity[] = [];
  let focusSummary = "";
  let source = "none";
  try {
    const result = await generateTargetedPractice({
      lesson,
      focus,
      count: want,
    });
    activities = result.activities;
    focusSummary = result.focusSummary;
    source = result.source;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 502 }
    );
  }

  activities = activities.map((a) => ({
    ...a,
    id: a.id.startsWith("gen-")
      ? a.id
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
    focusSummary,
    source,
    weakSkills: focus.weakSkills,
    weakTypes: focus.weakTypes,
    generatedTotal: genRows.length + activities.length,
    max,
    progress,
  });
}
