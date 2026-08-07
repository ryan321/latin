import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-stone-50">
          Latin Year 1
        </h1>
        <p className="mt-1 text-sm text-stone-500">Sign in to continue</p>
        <LoginForm />
      </div>
    </main>
  );
}
