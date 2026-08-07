import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, lessonCompletions } from "@/db/schema";
import type {
  Activity,
  AnswerStatus,
  LessonContent,
  StandardRequirement,
} from "@/types/activity";

export type ProgressSnapshot = {
  met: boolean;
  requirements: {
    requirement: StandardRequirement;
    met: boolean;
    detail: string;
  }[];
  /** Latest status per activity id */
  latestByActivity: Record<
    string,
    { status: AnswerStatus; feedback: string | null }
  >;
};

type AttemptRow = {
  activityId: string;
  status: AnswerStatus;
  feedback: string | null;
  createdAt: Date;
};

export async function loadLatestAttempts(
  userId: string,
  lessonSlug: string
): Promise<AttemptRow[]> {
  const rows = await db
    .select({
      activityId: attempts.activityId,
      status: attempts.status,
      feedback: attempts.feedback,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .where(
      and(eq(attempts.userId, userId), eq(attempts.lessonSlug, lessonSlug))
    )
    .orderBy(desc(attempts.createdAt));

  // keep chronological for counting; latest map built separately
  return rows;
}

function latestMap(
  rows: AttemptRow[]
): Record<string, { status: AnswerStatus; feedback: string | null }> {
  const map: Record<
    string,
    { status: AnswerStatus; feedback: string | null }
  > = {};
  // rows are newest-first
  for (const r of rows) {
    if (!map[r.activityId]) {
      map[r.activityId] = { status: r.status, feedback: r.feedback };
    }
  }
  return map;
}

function countPassed(
  rows: AttemptRow[],
  pred: (activityId: string) => boolean
): number {
  // Count distinct activity ids that have at least one passed
  const passed = new Set<string>();
  for (const r of rows) {
    if (r.status === "passed" && pred(r.activityId)) passed.add(r.activityId);
  }
  return passed.size;
}

export function evaluateStandard(
  lesson: LessonContent,
  activities: Activity[],
  rows: AttemptRow[]
): ProgressSnapshot {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const latestByActivity = latestMap(rows);

  const requirements = lesson.standard.requirements.map((req) => {
    if (req.type === "activity_passed") {
      const st = latestByActivity[req.activityId]?.status;
      const met = st === "passed";
      return {
        requirement: req,
        met,
        detail: met
          ? `Passed ${req.activityId}`
          : `Need to pass activity ${req.activityId}`,
      };
    }
    if (req.type === "count") {
      const n = countPassed(rows, (id) => byId.get(id)?.type === req.activityType);
      const met = n >= req.n;
      return {
        requirement: req,
        met,
        detail: `${n}/${req.n} ${req.activityType} passed`,
      };
    }
    if (req.type === "translate_count") {
      const n = countPassed(rows, (id) => {
        const a = byId.get(id);
        if (!a || a.type !== "translate") return false;
        const p = a.payload as {
          direction?: string;
          length?: string;
        };
        if (req.direction && p.direction !== req.direction) return false;
        if (req.length && p.length !== req.length) return false;
        return true;
      });
      const met = n >= req.n;
      const dir = req.direction ?? "any";
      const len = req.length ?? "any";
      return {
        requirement: req,
        met,
        detail: `${n}/${req.n} translate (${dir}, ${len}) passed`,
      };
    }
    if (req.type === "paradigm_mastery") {
      const n = countPassed(
        rows,
        (id) => byId.get(id)?.type === "paradigm_grid"
      );
      const met = n >= req.n;
      return {
        requirement: req,
        met,
        detail: `${n}/${req.n} paradigm grids passed`,
      };
    }
    return {
      requirement: req,
      met: false,
      detail: "Unknown requirement",
    };
  });

  return {
    met: requirements.every((r) => r.met),
    requirements,
    latestByActivity,
  };
}

export async function recomputeStandard(
  userId: string,
  lesson: LessonContent,
  activities: Activity[]
): Promise<ProgressSnapshot> {
  const rows = await loadLatestAttempts(userId, lesson.slug);
  const progress = evaluateStandard(lesson, activities, rows);

  if (progress.met) {
    await db
      .insert(lessonCompletions)
      .values({
        userId,
        lessonSlug: lesson.slug,
        source: "standard",
      })
      .onConflictDoNothing({
        target: [lessonCompletions.userId, lessonCompletions.lessonSlug],
      });
  }

  return progress;
}

export async function isLessonComplete(
  userId: string,
  lessonSlug: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: lessonCompletions.id })
    .from(lessonCompletions)
    .where(
      and(
        eq(lessonCompletions.userId, userId),
        eq(lessonCompletions.lessonSlug, lessonSlug)
      )
    )
    .limit(1);
  return !!row;
}

export async function getCompletedSlugs(
  userId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ lessonSlug: lessonCompletions.lessonSlug })
    .from(lessonCompletions)
    .where(eq(lessonCompletions.userId, userId));
  return new Set(rows.map((r) => r.lessonSlug));
}

/** Lesson is unlocked if it is the first, or the previous lesson is complete. */
export function isUnlocked(
  lessonSlug: string,
  orderedSlugs: string[],
  completed: Set<string>
): boolean {
  const idx = orderedSlugs.indexOf(lessonSlug);
  if (idx <= 0) return true;
  const prev = orderedSlugs[idx - 1]!;
  return completed.has(prev);
}
