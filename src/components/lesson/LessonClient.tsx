"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActivityCard } from "@/components/activities/ActivityCard";
import type { AnswerStatus, Activity } from "@/types/activity";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type ProgressReq = {
  met: boolean;
  detail: string;
};

type Props = {
  lessonSlug: string;
  unitSlug: string;
  title: string;
  standardSummary: string;
  teach: string;
  seeds: Activity[];
  generated: Activity[];
  initialLatest: Record<
    string,
    { status: AnswerStatus; feedback: string | null }
  >;
  initialProgress: ProgressReq[];
  initialStandardMet: boolean;
  initialMessages: ChatMessage[];
  prev: { unitSlug: string; slug: string; title: string } | null;
  next: { unitSlug: string; slug: string; title: string } | null;
};

export function LessonClient({
  lessonSlug,
  unitSlug,
  title,
  standardSummary,
  teach,
  seeds,
  generated: initialGenerated,
  initialLatest,
  initialProgress,
  initialStandardMet,
  initialMessages,
  prev,
  next,
}: Props) {
  const [generated, setGenerated] = useState(initialGenerated);
  const [latest, setLatest] = useState(initialLatest);
  const [progress, setProgress] = useState(initialProgress);
  const [standardMet, setStandardMet] = useState(initialStandardMet);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chatBusy]);

  const activities = useMemo(
    () => [...seeds, ...generated],
    [seeds, generated]
  );

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || chatBusy) return;
    const text = draft.trim();
    setDraft("");
    setChatBusy(true);
    setChatError(null);
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonSlug, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatBusy(false);
    }
  }

  async function morePractice() {
    setGenBusy(true);
    setGenError(null);
    try {
      const issues = Object.values(latest)
        .filter((l) => l.status !== "passed")
        .flatMap(() => []);
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonSlug, issues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate practice");
      if (data.activities?.length) {
        setGenerated((g) => [...g, ...data.activities]);
      } else if (data.message) {
        setGenError(data.message);
      } else {
        setGenError("No new items returned — try the tutor or check your API key.");
      }
      if (data.standardMet) setStandardMet(true);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
      <article className="space-y-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-500">
            {unitSlug.replace(/^\d+-/, "").replace(/-/g, " ")}
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-stone-900 dark:text-stone-50">
            {title}
          </h1>
        </header>

        <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-400">
            Standard
          </h2>
          <p className="mt-1 text-sm text-stone-800 dark:text-stone-200">
            {standardSummary}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-stone-600 dark:text-stone-400">
            {progress.map((r, i) => (
              <li key={i}>
                <span className="mr-1">{r.met ? "✓" : "○"}</span>
                {r.detail}
              </li>
            ))}
          </ul>
        </section>

        <section className="prose prose-stone max-w-none rounded-xl border border-stone-200 bg-white p-5 dark:prose-invert dark:border-stone-700 dark:bg-stone-900 prose-headings:font-serif prose-p:text-sm prose-li:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{teach}</ReactMarkdown>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
              Practice
            </h2>
            {!standardMet && (
              <button
                type="button"
                onClick={morePractice}
                disabled={genBusy}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                {genBusy ? "Generating…" : "More practice"}
              </button>
            )}
          </div>
          {genError && (
            <p className="text-xs text-rose-700 dark:text-rose-300">{genError}</p>
          )}
          <ol className="space-y-4">
            {activities.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                lessonSlug={lessonSlug}
                initialStatus={latest[a.id]?.status ?? null}
                initialFeedback={latest[a.id]?.feedback ?? null}
                onGraded={(result) => {
                  setLatest((L) => ({
                    ...L,
                    [a.id]: {
                      status: result.status,
                      feedback: result.feedback,
                    },
                  }));
                  if (result.progress) setProgress(result.progress);
                  setStandardMet(result.standardMet);
                }}
              />
            ))}
          </ol>
        </section>

        {standardMet && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            <span>Standard met for this lesson.</span>
            {next && (
              <Link
                href={`/units/${next.unitSlug}/${next.slug}`}
                className="rounded-lg bg-emerald-800 px-3 py-1.5 font-semibold text-emerald-50 hover:bg-emerald-900"
              >
                Next: {next.title} →
              </Link>
            )}
          </div>
        )}

        <nav className="flex justify-between gap-3 pb-8 text-sm">
          {prev ? (
            <Link
              href={`/units/${prev.unitSlug}/${prev.slug}`}
              className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/units/${next.unitSlug}/${next.slug}`}
              className={
                standardMet
                  ? "font-medium text-stone-700 dark:text-stone-200"
                  : "text-stone-400"
              }
            >
              {next.title} →
            </Link>
          ) : (
            <span className="text-stone-400">End of content</span>
          )}
        </nav>
      </article>

      <aside>
        <div
          className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 lg:sticky lg:top-6"
          style={{ height: "calc(100vh - 6rem)", maxHeight: 720 }}
        >
          <div className="border-b border-stone-200 px-4 py-3 dark:border-stone-700">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Tutor
            </h3>
            <p className="text-xs text-stone-500">
              Ask about grammar, forms, or this lesson.
            </p>
          </div>
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && !chatBusy && (
              <p className="text-sm italic text-stone-400">
                e.g. “Why is the ablative used after in?”
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-6 bg-amber-800 text-amber-50"
                    : "prose prose-sm mr-6 max-w-none border border-stone-200 bg-stone-50 text-stone-800 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100 prose-p:my-1"
                }`}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            ))}
            {chatBusy && (
              <div className="mr-6 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-400 dark:border-stone-600">
                Thinking…
              </div>
            )}
            {chatError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {chatError}
              </div>
            )}
          </div>
          <form
            onSubmit={sendChat}
            className="border-t border-stone-200 p-3 dark:border-stone-700"
          >
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask the tutor…"
                className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
              />
              <button
                type="submit"
                disabled={chatBusy || !draft.trim()}
                className="rounded-md bg-stone-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-stone-200 dark:text-stone-900"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </aside>
    </main>
  );

}
