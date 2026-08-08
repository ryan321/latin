import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { UserMenu } from "@/components/layout/UserMenu";

export async function TopNav() {
  const session = await auth();
  if (!session?.user) return null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-100/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="shrink-0 font-serif text-lg font-bold tracking-tight text-stone-900 dark:text-stone-50"
          >
            Latin <span className="text-amber-800 dark:text-amber-500">Year 1</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50"
            >
              Units
            </Link>
            <Link
              href="/practice/flashcards"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50"
            >
              Flashcards
            </Link>
            <Link
              href="/help/typing"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50"
            >
              Typing
            </Link>
            {session.user.isTeacher && (
              <Link
                href="/teacher"
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50"
              >
                Teacher
              </Link>
            )}
          </nav>
        </div>

        <UserMenu
          name={session.user.name}
          username={session.user.username}
          isTeacher={session.user.isTeacher}
          signOutAction={signOutAction}
        />
      </div>
    </header>
  );
}
