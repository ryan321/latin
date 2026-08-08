import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  flashcardProgress,
  lessonCompletions,
  users,
} from "@/db/schema";
import { listAllLessons } from "@/lib/content";

export type StudentSummary = {
  id: string;
  username: string;
  name: string;
  isTeacher: boolean;
  createdAt: Date;
  completedCount: number;
  totalLessons: number;
  lastAttemptAt: Date | null;
  attemptCount: number;
};

export async function listStudents(): Promise<StudentSummary[]> {
  const totalLessons = listAllLessons().length;
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      isTeacher: users.isTeacher,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);

  const completions = await db
    .select({
      userId: lessonCompletions.userId,
      n: sql<number>`count(*)::int`,
    })
    .from(lessonCompletions)
    .groupBy(lessonCompletions.userId);

  const attemptAgg = await db
    .select({
      userId: attempts.userId,
      n: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${attempts.createdAt})`,
    })
    .from(attempts)
    .groupBy(attempts.userId);

  const compMap = new Map(completions.map((c) => [c.userId, Number(c.n)]));
  const attMap = new Map(
    attemptAgg.map((a) => [
      a.userId,
      { n: Number(a.n), lastAt: a.lastAt ? new Date(a.lastAt) : null },
    ])
  );

  return allUsers.map((u) => {
    const att = attMap.get(u.id);
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      isTeacher: u.isTeacher,
      createdAt: u.createdAt,
      completedCount: compMap.get(u.id) ?? 0,
      totalLessons,
      lastAttemptAt: att?.lastAt ?? null,
      attemptCount: att?.n ?? 0,
    };
  });
}

export async function getStudentDetail(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const lessons = listAllLessons();
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));

  const completions = await db
    .select()
    .from(lessonCompletions)
    .where(eq(lessonCompletions.userId, userId))
    .orderBy(desc(lessonCompletions.completedAt));

  const recentAttempts = await db
    .select({
      id: attempts.id,
      lessonSlug: attempts.lessonSlug,
      activityId: attempts.activityId,
      status: attempts.status,
      feedback: attempts.feedback,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.createdAt))
    .limit(40);

  const flashAgg = await db
    .select({
      cards: sql<number>`count(*)::int`,
      correct: sql<number>`coalesce(sum(${flashcardProgress.correctCount}), 0)::int`,
      wrong: sql<number>`coalesce(sum(${flashcardProgress.wrongCount}), 0)::int`,
    })
    .from(flashcardProgress)
    .where(eq(flashcardProgress.userId, userId));

  const completedSlugs = new Set(completions.map((c) => c.lessonSlug));

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      isTeacher: user.isTeacher,
      createdAt: user.createdAt,
    },
    completedCount: completions.length,
    totalLessons: lessons.length,
    completions: completions.map((c) => ({
      lessonSlug: c.lessonSlug,
      title: bySlug.get(c.lessonSlug)?.title ?? c.lessonSlug,
      unitSlug: bySlug.get(c.lessonSlug)?.unitSlug ?? "",
      completedAt: c.completedAt,
      source: c.source,
    })),
    recentAttempts: recentAttempts.map((a) => ({
      ...a,
      lessonTitle: bySlug.get(a.lessonSlug)?.title ?? a.lessonSlug,
    })),
    flashcards: {
      cardsTracked: Number(flashAgg[0]?.cards ?? 0),
      correct: Number(flashAgg[0]?.correct ?? 0),
      wrong: Number(flashAgg[0]?.wrong ?? 0),
    },
    incompleteLessons: lessons
      .filter((l) => !completedSlugs.has(l.slug))
      .slice(0, 20)
      .map((l) => ({ slug: l.slug, title: l.title, unitSlug: l.unitSlug })),
  };
}

export async function countPassedOnLesson(userId: string, lessonSlug: string) {
  const rows = await db
    .select({
      activityId: attempts.activityId,
      status: attempts.status,
    })
    .from(attempts)
    .where(
      and(eq(attempts.userId, userId), eq(attempts.lessonSlug, lessonSlug))
    )
    .orderBy(desc(attempts.createdAt));

  const latest = new Map<string, string>();
  for (const r of rows) {
    if (!latest.has(r.activityId)) latest.set(r.activityId, r.status);
  }
  let passed = 0;
  for (const s of latest.values()) {
    if (s === "passed") passed++;
  }
  return { distinctActivities: latest.size, passed };
}
