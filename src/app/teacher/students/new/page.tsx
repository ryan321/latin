import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateStudentForm } from "@/components/teacher/CreateStudentForm";

export default async function NewStudentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isTeacher) redirect("/");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Link
        href="/teacher"
        className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
      >
        ← Students
      </Link>
      <h1 className="mt-4 font-serif text-2xl font-bold text-stone-900 dark:text-stone-50">
        Create account
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Username + password only. Share the credentials with the student
        yourself.
      </p>
      <CreateStudentForm />
    </main>
  );
}
