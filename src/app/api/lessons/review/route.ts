import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { generatedActivities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLessonBySlug } from "@/lib/content";
import { writeRemediationCoach } from "@/lib/ai/coach";
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
  /** after_seeds = finished main set; after_extra = finished a remediation round */
  phase: z.enum(["after_seeds", "after_extra"]).default("after_seeds"),
  issues: z.array(z.string()).optional(),
});

/**
 * End-of-block review:
 * 1) Recompute standard
 * 2) If met → congratulatory coaching, no new items
 * 3) If not → coaching (instruction) + targeted practice questions
 */
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

  const { lessonSlug, phase, issues } = parsed.data;
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

  const generated = genRows.map((r) =>
    expandFromPattern(r.activity as Activity)
  );
  const allActivities = [...lesson.seeds, ...generated];
  const progress = await recomputeStandard(
    session.user.id,
    lesson,
    allActivities
  );

  const rows = await loadLatestAttempts(session.user.id, lessonSlug);

  // Require every seed attempted at least once for "after_seeds"
  const seedIds = lesson.seeds.map((s) => s.id);
  const attempted = new Set(rows.map((r) => r.activityId));
  const seedsAttempted = seedIds.every((id) => attempted.has(id));
  if (phase === "after_seeds" && !seedsAttempted) {
    const missing = seedIds.filter((id) => !attempted.has(id));
    return NextResponse.json(
      {
        error: "Finish the main practice questions first.",
        missingSeedIds: missing,
        seedsAttempted: false,
      },
      { status: 400 }
    );
  }

  const focus = collectRemediationFocus(progress, allActivities, rows);
  if (issues?.length) {
    for (const i of issues) {
      if (i && !focus.recentIssues.includes(i)) focus.recentIssues.push(i);
    }
  }

  const coachingMarkdown = await writeRemediationCoach({
    lesson,
    progress,
    focus,
    phase,
  });

  if (progress.met) {
    return NextResponse.json({
      standardMet: true,
      seedsAttempted: true,
      coachingMarkdown,
      activities: [] as Activity[],
      focusSummary: "standard met",
      progress: {
        met: progress.met,
        requirements: progress.requirements,
        weakSkills: progress.weakSkills,
        weakTypes: progress.weakTypes,
      },
    });
  }

  const max = Number(process.env.GENERATION_MAX_PER_LESSON ?? 24);
  const room = Math.max(0, max - genRows.length);
  const want = Math.min(4, room || 0);

  let activities: Activity[] = [];
  let focusSummary = "";
  let source = "none";

  if (want > 0) {
    const result = await generateTargetedPractice({
      lesson,
      focus,
      count: want,
    });
    activities = result.activities.map((a) => ({
      ...a,
      id: a.id.startsWith("gen-") ? a.id : `gen-${crypto.randomUUID().slice(0, 8)}`,
      source: "generated" as const,
    }));
    focusSummary = result.focusSummary;
    source = result.source;

    for (const a of activities) {
      await db.insert(generatedActivities).values({
        userId: session.user.id,
        lessonSlug,
        activity: a,
      });
    }
  }

  return NextResponse.json({
    standardMet: false,
    seedsAttempted: true,
    coachingMarkdown,
    activities,
    focusSummary,
    source,
    weakSkills: focus.weakSkills,
    weakTypes: focus.weakTypes,
    progress: {
      met: progress.met,
      requirements: progress.requirements,
      weakSkills: progress.weakSkills,
      weakTypes: progress.weakTypes,
    },
  });
}
