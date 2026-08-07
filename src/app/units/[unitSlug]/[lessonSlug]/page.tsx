import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chatMessages, generatedActivities } from "@/db/schema";
import {
  getAdjacentLessons,
  listAllLessons,
  loadLesson,
  loadTeachSource,
} from "@/lib/content";
import { expandFromPattern } from "@/lib/activities/templates";
import {
  getCompletedSlugs,
  isUnlocked,
  recomputeStandard,
} from "@/lib/standard";
import { LessonClient } from "@/components/lesson/LessonClient";
import { TeachBody } from "@/components/lesson/TeachBody";
import type { Activity } from "@/types/activity";
import Link from "next/link";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ unitSlug: string; lessonSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { unitSlug, lessonSlug } = await params;
  const lesson = loadLesson(unitSlug, lessonSlug);
  if (!lesson) notFound();

  const all = listAllLessons();
  const orderedSlugs = all.map((l) => l.slug);
  const completed = await getCompletedSlugs(session.user.id);
  if (!isUnlocked(lesson.slug, orderedSlugs, completed)) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-xl font-bold">Lesson locked</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Meet the standard on the previous lesson first.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-amber-800 underline"
        >
          Back to units
        </Link>
      </main>
    );
  }

  const genRows = await db
    .select()
    .from(generatedActivities)
    .where(
      and(
        eq(generatedActivities.userId, session.user.id),
        eq(generatedActivities.lessonSlug, lesson.slug)
      )
    );

  const generated = genRows.map((r) =>
    expandFromPattern(r.activity as Activity)
  );

  const progress = await recomputeStandard(session.user.id, lesson, [
    ...lesson.seeds,
    ...generated,
  ]);

  const chatRows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, session.user.id),
        eq(chatMessages.lessonSlug, lesson.slug)
      )
    )
    .orderBy(asc(chatMessages.createdAt));

  const { prev, next } = getAdjacentLessons(lesson.slug);
  const { source: teachSource } = loadTeachSource(
    unitSlug,
    lessonSlug,
    lesson.teach
  );
  const teachContent = await TeachBody({ source: teachSource });

  return (
    <LessonClient
      lessonSlug={lesson.slug}
      unitSlug={lesson.unitSlug}
      title={lesson.title}
      standardSummary={lesson.standardSummary}
      teachContent={teachContent}
      seeds={lesson.seeds}
      generated={generated}
      initialLatest={progress.latestByActivity}
      initialProgress={progress.requirements.map((r) => ({
        met: r.met,
        detail: r.detail,
        remaining: r.remaining,
      }))}
      initialStandardMet={progress.met}
      initialMessages={chatRows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
      }))}
      prev={
        prev
          ? { unitSlug: prev.unitSlug, slug: prev.slug, title: prev.title }
          : null
      }
      next={
        next
          ? { unitSlug: next.unitSlug, slug: next.slug, title: next.title }
          : null
      }
    />
  );
}
