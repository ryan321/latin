"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (!result) {
        setError("Sign-in failed — no response from auth.");
        return;
      }
      if (result.error) {
        setError("Invalid username or password.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Sign-in failed. Is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <label className="block text-sm">
        <span className="text-stone-600 dark:text-stone-300">Username</span>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue="student"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-600 dark:text-stone-300">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue="latin-learn"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
        />
      </label>
      <p className="text-xs text-stone-400">
        Default seed: <strong>student</strong> / latin-learn · teacher:{" "}
        <strong>teacher</strong> / latin-teach
      </p>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-amber-800 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
