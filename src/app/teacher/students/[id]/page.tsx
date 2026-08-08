import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentDetail } from "@/lib/teacher";
import { ResetPasswordForm } from "@/components/teacher/ResetPasswordForm";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isTeacher) redirect("/");

  const { id } = await params;
  const detail = await getStudentDetail(id);
  if (!detail) notFound();

  const { user, completions, recentAttempts, flashcards } = detail;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/teacher"
        className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
      >
        ← Students
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-50">
          {user.name}
        </h1>
        <p className="text-sm text-stone-500">
          @{user.username}
          {user.isTeacher ? " · teacher" : " · student"}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Lessons met"
          value={`${detail.completedCount}/${detail.totalLessons}`}
        />
        <Stat
          label="Flashcard right / wrong"
          value={`${flashcards.correct} / ${flashcards.wrong}`}
        />
        <Stat label="Cards tracked" value={String(flashcards.cardsTracked)} />
      </section>

      <section className="mt-10 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          Reset password
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Sets a new password immediately. No email is sent — tell the student
          yourself.
        </p>
        <ResetPasswordForm userId={user.id} username={user.username} />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          Completed lessons ({completions.length})
        </h2>
        {completions.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">None yet.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
            {completions.map((c) => (
              <li
                key={c.lessonSlug + c.completedAt.toISOString()}
                className="flex justify-between gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0 dark:border-stone-800"
              >
                <span className="text-stone-800 dark:text-stone-100">
                  {c.title}
                </span>
                <span className="shrink-0 text-xs text-stone-400">
                  {c.completedAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          Recent attempts
        </h2>
        {recentAttempts.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No attempts yet.</p>
        ) : (
          <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {recentAttempts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-800 dark:text-stone-100">
                    {a.lessonTitle}
                  </span>
                  <StatusPill status={a.status} />
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {a.activityId} · {a.createdAt.toLocaleString()}
                </p>
                {a.feedback && (
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    {a.feedback}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.incompleteLessons.length > 0 && (
        <section className="mt-10 mb-8">
          <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
            Not yet completed (sample)
          </h2>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-600 dark:text-stone-400">
            {detail.incompleteLessons.map((l) => (
              <li key={`${l.unitSlug}/${l.slug}`}>{l.title}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl font-bold text-stone-900 dark:text-stone-50">
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "passed"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
      : status === "partial"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>
      {status}
    </span>
  );
}
