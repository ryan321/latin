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
    /** How many more passes needed (0 if met) */
    remaining: number;
  }[];
  /** Latest status per activity id */
  latestByActivity: Record<
    string,
    { status: AnswerStatus; feedback: string | null }
  >;
  /** Skills still below the bar (from skill_count requirements) */
  weakSkills: string[];
  /** Activity types still needed for count requirements */
  weakTypes: string[];
};

type AttemptRow = {
  activityId: string;
  status: AnswerStatus;
  feedback: string | null;
  issues: string[];
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
      issues: attempts.issues,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .where(
      and(eq(attempts.userId, userId), eq(attempts.lessonSlug, lessonSlug))
    )
    .orderBy(desc(attempts.createdAt));

  return rows.map((r) => ({
    ...r,
    issues: Array.isArray(r.issues) ? r.issues : [],
  }));
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

  const weakSkills: string[] = [];
  const weakTypes: string[] = [];

  const requirements = lesson.standard.requirements.map((req) => {
    if (req.type === "activity_passed") {
      const st = latestByActivity[req.activityId]?.status;
      const met = st === "passed";
      const act = byId.get(req.activityId);
      const label =
        act?.prompt?.slice(0, 60) ||
        req.activityId.replace(/-/g, " ");
      if (!met && act?.targets) {
        for (const t of act.targets) {
          if (!weakSkills.includes(t)) weakSkills.push(t);
        }
      }
      return {
        requirement: req,
        met,
        remaining: met ? 0 : 1,
        detail: met ? `Passed: ${label}` : `Need to pass: ${label}`,
      };
    }
    if (req.type === "count") {
      const n = countPassed(rows, (id) => byId.get(id)?.type === req.activityType);
      const met = n >= req.n;
      if (!met) weakTypes.push(req.activityType);
      return {
        requirement: req,
        met,
        remaining: Math.max(0, req.n - n),
        detail: `${n}/${req.n} ${req.activityType} activities passed`,
      };
    }
    if (req.type === "skill_count") {
      const n = countPassed(rows, (id) => {
        const a = byId.get(id);
        return !!a?.targets?.includes(req.skill);
      });
      const met = n >= req.n;
      if (!met && !weakSkills.includes(req.skill)) weakSkills.push(req.skill);
      const label = req.label ?? req.skill;
      return {
        requirement: req,
        met,
        remaining: Math.max(0, req.n - n),
        detail: `${n}/${req.n} on “${label}”`,
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
      if (!met) weakTypes.push("translate");
      const dir = req.direction ?? "any";
      const len = req.length ?? "any";
      return {
        requirement: req,
        met,
        remaining: Math.max(0, req.n - n),
        detail: `${n}/${req.n} translate (${dir}, ${len}) passed`,
      };
    }
    if (req.type === "paradigm_mastery") {
      const n = countPassed(
        rows,
        (id) => byId.get(id)?.type === "paradigm_grid"
      );
      const met = n >= req.n;
      if (!met) weakTypes.push("paradigm_grid");
      return {
        requirement: req,
        met,
        remaining: Math.max(0, req.n - n),
        detail: `${n}/${req.n} paradigm grids passed`,
      };
    }
    return {
      requirement: req,
      met: false,
      remaining: 1,
      detail: "Unknown requirement",
    };
  });

  return {
    met: requirements.every((r) => r.met),
    requirements,
    latestByActivity,
    weakSkills,
    weakTypes,
  };
}

/** Recent fail signals for targeted remediation. */
export function collectRemediationFocus(
  progress: ProgressSnapshot,
  activities: Activity[],
  rows: AttemptRow[]
): {
  weakSkills: string[];
  weakTypes: string[];
  recentIssues: string[];
  failedPrompts: string[];
  unmetDetails: string[];
} {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const recentIssues: string[] = [];
  const failedPrompts: string[] = [];

  // Newest-first rows: look at recent non-pass attempts
  for (const r of rows.slice(0, 40)) {
    if (r.status === "passed") continue;
    for (const issue of r.issues) {
      if (issue && !recentIssues.includes(issue)) recentIssues.push(issue);
    }
    const act = byId.get(r.activityId);
    if (act?.prompt && failedPrompts.length < 6) {
      failedPrompts.push(act.prompt.slice(0, 120));
    }
    if (act?.targets) {
      for (const t of act.targets) {
        if (!progress.weakSkills.includes(t)) {
          // still track as soft focus
        }
      }
    }
  }

  return {
    weakSkills: progress.weakSkills,
    weakTypes: progress.weakTypes,
    recentIssues,
    failedPrompts,
    unmetDetails: progress.requirements
      .filter((r) => !r.met)
      .map((r) => r.detail),
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

/**
 * Sequential gating: lesson opens when the previous one is complete.
 * Set UNLOCK_ALL_LESSONS=true (default for now) to open the full course.
 */
export function unlockAllLessonsEnabled(): boolean {
  const v = process.env.UNLOCK_ALL_LESSONS?.trim().toLowerCase();
  if (v === undefined || v === "") return true; // default open
  return v === "1" || v === "true" || v === "yes";
}

/** Lesson is unlocked if all-open mode, first lesson, or previous is complete. */
export function isUnlocked(
  lessonSlug: string,
  orderedSlugs: string[],
  completed: Set<string>
): boolean {
  if (unlockAllLessonsEnabled()) return true;
  const idx = orderedSlugs.indexOf(lessonSlug);
  if (idx <= 0) return true;
  const prev = orderedSlugs[idx - 1]!;
  return completed.has(prev);
}
