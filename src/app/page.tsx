import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { listAllLessons, listUnits } from "@/lib/content";
import { getCompletedSlugs, isUnlocked } from "@/lib/standard";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const units = listUnits();
  const lessons = listAllLessons();
  const completed = await getCompletedSlugs(session.user.id);
  const orderedSlugs = lessons.map((l) => l.slug);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 dark:text-stone-50">
            Latin Year 1
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Signed in as {session.user.name ?? session.user.email}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-stone-500 underline hover:text-stone-800"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="space-y-8">
        {units.map((unit) => {
          const unitLessons = lessons.filter((l) => l.unitSlug === unit.slug);
          return (
            <section key={unit.slug}>
              <h2 className="font-serif text-xl font-semibold text-stone-900 dark:text-stone-100">
                {unit.title}
              </h2>
              {unit.summary && (
                <p className="mt-1 text-sm text-stone-500">{unit.summary}</p>
              )}
              <ul className="mt-4 space-y-2">
                {unitLessons.map((lesson) => {
                  const done = completed.has(lesson.slug);
                  const unlocked = isUnlocked(
                    lesson.slug,
                    orderedSlugs,
                    completed
                  );
                  return (
                    <li key={lesson.slug}>
                      {unlocked ? (
                        <Link
                          href={`/units/${lesson.unitSlug}/${lesson.slug}`}
                          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-amber-300 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-amber-700"
                        >
                          <span className="font-medium text-stone-800 dark:text-stone-100">
                            {lesson.title}
                          </span>
                          <span className="text-xs text-stone-500">
                            {done ? "Complete" : "Open"}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-4 py-3 text-sm text-stone-400 dark:border-stone-800 dark:bg-stone-950">
                          <span>{lesson.title}</span>
                          <span className="text-xs">Locked</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
