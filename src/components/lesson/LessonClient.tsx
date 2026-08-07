"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  FormEvent,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActivityCard } from "@/components/activities/ActivityCard";
import {
  FlashcardPractice,
  type FlashcardClient,
} from "@/components/flashcards/FlashcardPractice";
import type { AnswerStatus, Activity } from "@/types/activity";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type ProgressReq = {
  met: boolean;
  detail: string;
  remaining?: number;
};

type Props = {
  lessonSlug: string;
  unitSlug: string;
  title: string;
  standardSummary: string;
  teachContent: ReactNode;
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
  /** Dynamic flashcards from this lesson (practice only, not graded). */
  flashcards?: FlashcardClient[];
};

export function LessonClient({
  lessonSlug,
  unitSlug,
  title,
  standardSummary,
  teachContent,
  seeds,
  generated: initialGenerated,
  initialLatest,
  initialProgress,
  initialStandardMet,
  initialMessages,
  prev,
  next,
  flashcards = [],
}: Props) {
  const [generated, setGenerated] = useState(initialGenerated);
  const [latest, setLatest] = useState(initialLatest);
  const [progress, setProgress] = useState(initialProgress);
  const [standardMet, setStandardMet] = useState(initialStandardMet);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [coachingMarkdown, setCoachingMarkdown] = useState<string | null>(
    null
  );
  const [reviewDoneOnce, setReviewDoneOnce] = useState(false);
  /** Activity ids from the latest remediation batch; when all checked, auto-review again. */
  const [pendingBatchIds, setPendingBatchIds] = useState<string[]>([]);
  const [recentIssues, setRecentIssues] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const coachRef = useRef<HTMLDivElement | null>(null);
  const autoSeedReviewFired = useRef(false);
  const autoBatchReviewKey = useRef<string | null>(null);

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

  const seedsAllAttempted = useMemo(
    () => seeds.every((s) => latest[s.id] != null),
    [seeds, latest]
  );

  const seedSection = seeds;
  const extraSection = generated;

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

  async function runReview(phase: "after_seeds" | "after_extra") {
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/lessons/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonSlug,
          phase,
          issues: recentIssues,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");

      if (data.progress?.requirements) {
        setProgress(
          data.progress.requirements.map(
            (r: { met: boolean; detail: string; remaining?: number }) => ({
              met: r.met,
              detail: r.detail,
              remaining: r.remaining,
            })
          )
        );
      }
      const met = !!data.standardMet;
      setStandardMet(met);
      setCoachingMarkdown(data.coachingMarkdown ?? null);
      setReviewDoneOnce(true);

      const newActs = (data.activities as Activity[] | undefined) ?? [];
      if (newActs.length) {
        setGenerated((g) => {
          const ids = new Set(g.map((x) => x.id));
          const add = newActs.filter((a) => !ids.has(a.id));
          return [...g, ...add];
        });
        // New batch to complete before the next auto-review
        const batchIds = newActs.map((a) => a.id);
        setPendingBatchIds(batchIds);
        autoBatchReviewKey.current = null;
      } else {
        // No new items (met, or generation empty) — clear batch loop
        setPendingBatchIds([]);
        autoBatchReviewKey.current = null;
      }

      if (data.coachingMarkdown) {
        setMessages((m) => [
          ...m,
          {
            id: `coach-${Date.now()}`,
            role: "assistant",
            content: data.coachingMarkdown,
          },
        ]);
      }

      requestAnimationFrame(() => {
        coachRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Review failed");
      // Allow retry of the same batch auto-review
      autoBatchReviewKey.current = null;
    } finally {
      setReviewBusy(false);
    }
  }

  // 1) Auto-review when every seed has been checked (once)
  useEffect(() => {
    if (
      !standardMet &&
      seedsAllAttempted &&
      !reviewDoneOnce &&
      !autoSeedReviewFired.current &&
      !reviewBusy
    ) {
      autoSeedReviewFired.current = true;
      void runReview("after_seeds");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedsAllAttempted, standardMet, reviewDoneOnce]);

  // 2) Auto-review when the current extra-practice batch is fully attempted
  //    → loop: coach → practice → evaluate → coach → … until standard met
  const pendingBatchComplete =
    pendingBatchIds.length > 0 &&
    pendingBatchIds.every((id) => latest[id] != null);

  useEffect(() => {
    if (standardMet || reviewBusy || !pendingBatchComplete) return;
    const key = pendingBatchIds.slice().sort().join("|");
    if (!key || autoBatchReviewKey.current === key) return;
    autoBatchReviewKey.current = key;
    void runReview("after_extra");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBatchComplete, standardMet, reviewBusy, pendingBatchIds, latest]);

  function onActivityGraded(
    activityId: string,
    result: {
      status: AnswerStatus;
      feedback: string;
      standardMet: boolean;
      issues?: string[];
      progress?: ProgressReq[];
    }
  ) {
    setLatest((L) => ({
      ...L,
      [activityId]: {
        status: result.status,
        feedback: result.feedback,
      },
    }));
    if (result.issues?.length) {
      setRecentIssues((prev) => {
        const next = [...result.issues!, ...prev];
        return [...new Set(next)].slice(0, 12);
      });
    }
    if (result.progress) setProgress(result.progress);
    setStandardMet(result.standardMet);
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

        <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6 dark:border-stone-700 dark:bg-stone-900">
          {teachContent}
        </section>

        {/* ── Main practice (seeds) ───────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
              Practice
            </h2>
            <p className="text-xs text-stone-500">
              Work through these questions. When you finish the set, we check
              the standard and add help only where you need it.
            </p>
          </div>
          <ol className="space-y-4">
            {seedSection.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                lessonSlug={lessonSlug}
                initialStatus={latest[a.id]?.status ?? null}
                initialFeedback={latest[a.id]?.feedback ?? null}
                onGraded={(result) => onActivityGraded(a.id, result)}
              />
            ))}
          </ol>

          {seedsAllAttempted && !standardMet && !reviewBusy && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm text-amber-950 dark:text-amber-100">
                {reviewDoneOnce
                  ? "You can re-check the standard after extra practice."
                  : "You’ve answered the main set — checking how you did…"}
              </p>
              <button
                type="button"
                onClick={() =>
                  runReview(reviewDoneOnce ? "after_extra" : "after_seeds")
                }
                disabled={reviewBusy}
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-50"
              >
                {reviewBusy
                  ? "Reviewing…"
                  : reviewDoneOnce
                    ? "Review progress again"
                    : "See how I did"}
              </button>
            </div>
          )}
          {reviewBusy && (
            <p className="text-sm text-stone-500">
              Looking at your answers and preparing feedback…
            </p>
          )}
          {reviewError && (
            <p className="text-sm text-rose-700 dark:text-rose-300">
              {reviewError}
            </p>
          )}
        </section>

        {/* ── Coach + remediation ─────────────────────────── */}
        {coachingMarkdown && (
          <section
            ref={coachRef}
            className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-amber-50/40 p-5 shadow-sm dark:border-sky-900 dark:from-sky-950/40 dark:to-amber-950/20"
          >
            <h2 className="text-xs font-bold uppercase tracking-wide text-sky-900 dark:text-sky-300">
              Coach
            </h2>
            <div className="prose prose-sm mt-2 max-w-none prose-stone dark:prose-invert prose-p:my-2 prose-headings:font-serif">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {coachingMarkdown}
              </ReactMarkdown>
            </div>
          </section>
        )}

        {extraSection.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
                Extra practice
              </h2>
              <p className="text-xs text-stone-500">
                Aimed at what you still need for this lesson’s standard.
              </p>
            </div>
            <ol className="space-y-4">
              {extraSection.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  lessonSlug={lessonSlug}
                  initialStatus={latest[a.id]?.status ?? null}
                  initialFeedback={latest[a.id]?.feedback ?? null}
                  onGraded={(result) => onActivityGraded(a.id, result)}
                />
              ))}
            </ol>
            {!standardMet && pendingBatchIds.length > 0 && (
              <p className="text-center text-xs text-stone-500">
                {pendingBatchComplete || reviewBusy
                  ? "Checking how you did on this set…"
                  : `Answer each extra question — when this set is done, we review automatically (${pendingBatchIds.filter((id) => latest[id] != null).length}/${pendingBatchIds.length} checked).`}
              </p>
            )}
            {!standardMet && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => runReview("after_extra")}
                  disabled={reviewBusy}
                  className="rounded-lg border border-amber-800/40 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:bg-stone-900 dark:text-amber-100"
                >
                  {reviewBusy
                    ? "Reviewing…"
                    : "Review now (don’t wait for full set)"}
                </button>
              </div>
            )}
          </section>
        )}

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

        {/* Flashcards — practice only; does not affect the lesson standard */}
        {flashcards.length > 0 && (
          <FlashcardPractice
            initialCards={flashcards}
            title="Lesson flashcards"
            subtitle="Built from this lesson’s material. Optional practice — not part of the standard."
            embedded
          />
        )}
        <p className="text-center text-xs text-stone-500">
          <Link
            href="/practice/flashcards"
            className="font-medium text-violet-800 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Vocab flashcards & weak words →
          </Link>
        </p>

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
          className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 lg:sticky lg:top-20"
          style={{ height: "calc(100vh - 7.5rem)", maxHeight: 720 }}
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
