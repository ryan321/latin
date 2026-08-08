"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function initials(
  name: string | null | undefined,
  username: string | null | undefined
): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || "?";
  }
  if (username?.trim()) return username.charAt(0).toUpperCase();
  return "?";
}

type Props = {
  name: string | null | undefined;
  username: string | null | undefined;
  isTeacher?: boolean;
  signOutAction: () => Promise<void>;
};

export function UserMenu({
  name,
  username,
  isTeacher,
  signOutAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const label = name?.trim() || username || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-800 to-amber-600 text-sm font-semibold text-amber-50 shadow-sm ring-2 ring-transparent transition hover:ring-amber-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
      >
        {initials(name, username)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="border-b border-stone-100 px-3 py-2.5 dark:border-stone-800">
            <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-50">
              {label}
            </p>
            {username && (
              <p className="truncate text-xs text-stone-500">@{username}</p>
            )}
            {isTeacher && (
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-400">
                Teacher
              </p>
            )}
          </div>

          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Course home
          </Link>
          {isTeacher && (
            <Link
              href="/teacher"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Teacher dashboard
            </Link>
          )}
          <Link
            href="/practice/flashcards"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Flashcards
          </Link>
          <Link
            href="/help/typing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Typing help
          </Link>

          <div className="my-1 border-t border-stone-100 dark:border-stone-800" />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
