import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listStudents } from "@/lib/teacher";

export default async function TeacherHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isTeacher) redirect("/");

  const students = await listStudents();
  const learners = students.filter((s) => !s.isTeacher);
  const teachers = students.filter((s) => s.isTeacher);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-500">
            Teacher
          </p>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-50">
            Students
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            View progress and results. Create accounts and reset passwords here
            — no email.
          </p>
        </div>
        <Link
          href="/teacher/students/new"
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-900"
        >
          + New account
        </Link>
      </header>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Learners ({learners.length})
        </h2>
        {learners.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No student accounts yet. Create one to get started.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-700 dark:bg-stone-900">
            {learners.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/students/${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/60"
                >
                  <div>
                    <p className="font-medium text-stone-900 dark:text-stone-50">
                      {s.name}
                    </p>
                    <p className="text-xs text-stone-500">@{s.username}</p>
                  </div>
                  <div className="text-right text-xs text-stone-500">
                    <p>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {s.completedCount}
                      </span>
                      /{s.totalLessons} lessons met
                    </p>
                    <p>
                      {s.attemptCount} attempts
                      {s.lastAttemptAt
                        ? ` · last ${s.lastAttemptAt.toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {teachers.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Teachers ({teachers.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {teachers.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
              >
                <span>
                  {t.name}{" "}
                  <span className="text-stone-400">@{t.username}</span>
                </span>
                <Link
                  href={`/teacher/students/${t.id}`}
                  className="text-xs font-medium text-amber-800 underline dark:text-amber-400"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
