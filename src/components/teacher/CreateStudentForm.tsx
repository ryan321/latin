"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateStudentForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const body = {
      username: String(form.get("username") ?? ""),
      name: String(form.get("name") ?? ""),
      password: String(form.get("password") ?? ""),
      isTeacher: form.get("isTeacher") === "on",
    };
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account");
        return;
      }
      router.push(`/teacher/students/${data.user.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}
      <label className="block text-sm">
        <span className="font-medium text-stone-700 dark:text-stone-200">
          Display name
        </span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
          placeholder="Alex"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-700 dark:text-stone-200">
          Username
        </span>
        <input
          name="username"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[A-Za-z0-9_-]{2,32}"
          title="2–32 characters: letters, numbers, _ or -"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
          placeholder="alex"
        />
        <span className="mt-0.5 block text-xs text-stone-400">
          Lowercase letters, numbers, _ or - (2–32 chars)
        </span>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-700 dark:text-stone-200">
          Password
        </span>
        <input
          name="password"
          type="text"
          required
          minLength={4}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
          placeholder="temporary-password"
        />
        <span className="mt-0.5 block text-xs text-stone-400">
          Shown as text so you can copy it for the student
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
        <input name="isTeacher" type="checkbox" className="rounded" />
        Teacher account (can manage students)
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-amber-800 py-2.5 text-sm font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
