"use client";

import { FormEvent, useState } from "react";

export function ResetPasswordForm({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/students/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      setMsg(`Password updated for @${username}.`);
      setPassword("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      {error && (
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
      )}
      {msg && (
        <p className="text-sm text-emerald-800 dark:text-emerald-300">{msg}</p>
      )}
      <label className="block text-sm">
        <span className="text-stone-600 dark:text-stone-300">New password</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 dark:border-stone-600 dark:bg-stone-950"
          placeholder="new-temporary-password"
        />
      </label>
      <button
        type="submit"
        disabled={busy || password.length < 4}
        className="rounded-lg border border-amber-800/40 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        {busy ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}
