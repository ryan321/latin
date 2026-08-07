"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type FlashcardClient = {
  key: string;
  /** Latin — always shown first */
  front: string;
  /** English — revealed on flip */
  back: string;
  kind?: string;
  sourceLesson?: string;
  correctCount?: number;
  wrongCount?: number;
  streak?: number;
  lastResult?: string | null;
};

export type DeckQuery = {
  mode: "lessons" | "weak";
  lessons?: string[];
  onlyWeak?: boolean;
};

type Props = {
  initialCards?: FlashcardClient[];
  /** @deprecated prefer deckQuery */
  lessonSlugs?: string[];
  /** How to load the deck from the API (picker). */
  deckQuery?: DeckQuery;
  /** Chosen when the deck is built (default Latin first). */
  initialDirection?: CardDirection;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
  onChangeLessons?: () => void;
};

type SessionStats = { right: number; wrong: number };

/** L2E = Latin first; E2L = English first */
export type CardDirection = "L2E" | "E2L";

const EMPTY_SLUGS: string[] = [];
const EMPTY_CARDS: FlashcardClient[] = [];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function deckFingerprint(cards: FlashcardClient[] | undefined): string {
  if (!cards?.length) return "";
  return cards.map((c) => c.key).join("|");
}

/**
 * Queue model: `remaining[0]` is always the current card.
 * Stored as Latin (front) / English (back); display order follows `direction`.
 */
export function FlashcardPractice({
  initialCards,
  lessonSlugs = EMPTY_SLUGS,
  deckQuery,
  initialDirection = "L2E",
  title = "Flashcards",
  subtitle,
  embedded = false,
  onChangeLessons,
}: Props) {
  const seedCards = initialCards ?? EMPTY_CARDS;
  const [baseDeck, setBaseDeck] = useState<FlashcardClient[]>(seedCards);
  /** Cards still to do this pass; index 0 = current */
  const [remaining, setRemaining] = useState<FlashcardClient[]>(seedCards);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState<CardDirection>(initialDirection);
  const [session, setSession] = useState<SessionStats>({ right: 0, wrong: 0 });
  const resolvedQuery: DeckQuery | null = deckQuery
    ? deckQuery
    : lessonSlugs.length > 0
      ? { mode: "lessons", lessons: lessonSlugs }
      : null;
  const [loading, setLoading] = useState(
    !initialCards?.length && resolvedQuery != null
  );
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [showStack, setShowStack] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const gradingLock = useRef(false);

  // Stored: front = Latin, back = English
  const promptSide = direction === "L2E" ? "latin" : "english";
  const answerSide = direction === "L2E" ? "english" : "latin";

  const initialFp = deckFingerprint(initialCards);
  const queryKey = resolvedQuery
    ? `${resolvedQuery.mode}|${resolvedQuery.onlyWeak ? "1" : "0"}|${(resolvedQuery.lessons ?? []).join(",")}`
    : "";

  // Keep direction in sync when a new deck is built with a chosen direction
  useEffect(() => {
    setDirection(initialDirection);
    setFlipped(false);
  }, [initialDirection, queryKey, initialFp]);

  const resetWith = useCallback((list: FlashcardClient[]) => {
    setBaseDeck(list);
    setRemaining(list);
    setFlipped(false);
    setSession({ right: 0, wrong: 0 });
    setSeenCount(0);
    setShowStack(false);
    gradingLock.current = false;
  }, []);

  const loadDeck = useCallback(
    async (q: DeckQuery) => {
      setLoading(true);
      setError(null);
      setEmptyMessage(null);
      try {
        const params = new URLSearchParams();
        if (q.mode === "weak") {
          params.set("mode", "weak");
          if (q.lessons?.length) params.set("lessons", q.lessons.join(","));
        } else {
          params.set("mode", "lessons");
          params.set("lessons", (q.lessons ?? []).join(","));
          if (q.onlyWeak) params.set("onlyWeak", "1");
        }
        const res = await fetch(`/api/flashcards/deck?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load deck");
        const list = (data.cards ?? []) as FlashcardClient[];
        resetWith(list);
        if (list.length === 0 && data.message) {
          setEmptyMessage(String(data.message));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [resetWith]
  );

  useEffect(() => {
    if (!initialCards?.length) return;
    resetWith(initialCards);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFp]);

  useEffect(() => {
    if (initialCards?.length) return;
    if (!resolvedQuery) return;
    void loadDeck(resolvedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, loadDeck, initialFp]);

  const current = remaining[0] ?? null;
  const done = !loading && remaining.length === 0 && baseDeck.length > 0;
  const total = baseDeck.length;
  const progressPct =
    total === 0 ? 0 : Math.min(100, Math.round((seenCount / total) * 100));

  const displayPrompt = current
    ? direction === "L2E"
      ? current.front
      : current.back
    : "";
  const displayAnswer = current
    ? direction === "L2E"
      ? current.back
      : current.front
    : "";

  function grade(result: "know" | "again") {
    if (!current || !flipped || gradingLock.current) return;
    gradingLock.current = true;

    const graded = current;

    void fetch("/api/flashcards/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardKey: graded.key,
        front: graded.front,
        back: graded.back,
        result,
        sourceLesson: graded.sourceLesson,
      }),
    }).catch(() => {});

    setSession((s) => ({
      right: s.right + (result === "know" ? 1 : 0),
      wrong: s.wrong + (result === "again" ? 1 : 0),
    }));
    setSeenCount((n) => n + 1);

    // Pop current; if wrong, append to end so it comes back later
    setRemaining((queue) => {
      const [, ...rest] = queue;
      if (result === "again") {
        return [...rest, graded];
      }
      return rest;
    });

    // Next card always starts on the prompt side (not flipped)
    setFlipped(false);
    // Unlock after paint so the next card can't be double-graded instantly
    requestAnimationFrame(() => {
      gradingLock.current = false;
    });
  }

  function restartFull() {
    resetWith([...baseDeck]);
  }

  function shuffleRemaining() {
    if (remaining.length <= 1) return;
    setRemaining((q) => shuffle(q));
    setFlipped(false);
  }

  function removeCurrentFromStack() {
    if (!current) return;
    const key = current.key;
    setBaseDeck((d) => d.filter((c) => c.key !== key));
    setRemaining((q) => q.filter((c) => c.key !== key));
    setFlipped(false);
  }

  function removeFromStackByKey(key: string) {
    setBaseDeck((d) => d.filter((c) => c.key !== key));
    setRemaining((q) => q.filter((c) => c.key !== key));
    setFlipped(false);
  }

  const shell = embedded
    ? "rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-stone-50 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:to-stone-950"
    : "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-stone-50 p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:to-stone-950 sm:p-6";

  if (loading) {
    return (
      <section className={shell}>
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-500">Building flashcards…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={shell}>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      </section>
    );
  }

  if (baseDeck.length === 0) {
    return (
      <section className={shell}>
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {emptyMessage ??
            "No Latin→English cards found yet. Try vocabulary lessons, or practice a bit first so “weak” words can appear."}
        </p>
        {onChangeLessons && (
          <button
            type="button"
            onClick={onChangeLessons}
            className="mt-3 text-sm font-medium text-violet-800 underline dark:text-violet-300"
          >
            Choose different lessons
          </button>
        )}
      </section>
    );
  }

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800/70 dark:text-violet-300/80">
            Practice ·{" "}
            {direction === "L2E" ? "Latin → English" : "English → Latin"} · not
            graded
          </p>
          <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-stone-500">
          {!done && current && (
            <p>
              {remaining.length} card{remaining.length === 1 ? "" : "s"} left
            </p>
          )}
          <p>
            <span className="text-emerald-700 dark:text-emerald-400">
              Right {session.right}
            </span>
            {" · "}
            <span className="text-rose-700 dark:text-rose-400">
              Wrong {session.wrong}
            </span>
          </p>
        </div>
      </div>

      {!done && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={restartFull}
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
        >
          Restart deck
        </button>
        {!done && (
          <button
            type="button"
            onClick={shuffleRemaining}
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
          >
            Shuffle remaining
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowStack((s) => !s)}
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
        >
          {showStack ? "Hide stack" : `Edit stack (${baseDeck.length})`}
        </button>
        {onChangeLessons ? (
          <button
            type="button"
            onClick={onChangeLessons}
            className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
          >
            Change lessons
          </button>
        ) : (
          <Link
            href="/practice/flashcards"
            className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
          >
            More lessons…
          </Link>
        )}
      </div>

      {showStack && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
          <p className="sticky top-0 border-b border-stone-100 bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500 dark:border-stone-800 dark:bg-stone-950">
            Latin · English pairs. Remove cards you don’t want in this stack.
          </p>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {baseDeck.map((c) => (
              <li
                key={c.key}
                className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-serif font-semibold text-stone-900 dark:text-stone-50">
                    {c.front}
                  </span>
                  <span className="text-stone-400"> · </span>
                  <span className="text-stone-600 dark:text-stone-300">
                    {c.back}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFromStackByKey(c.key)}
                  className="shrink-0 text-xs font-medium text-rose-700 hover:underline dark:text-rose-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <div className="mt-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Deck complete — practice only, not part of the lesson standard.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Got it right" value={session.right} tone="good" />
            <Stat label="Got it wrong" value={session.wrong} tone="warn" />
            <Stat label="In deck" value={baseDeck.length} tone="neutral" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restartFull}
              className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-900"
            >
              Restart deck
            </button>
            {onChangeLessons && (
              <button
                type="button"
                onClick={onChangeLessons}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium dark:border-stone-600 dark:bg-stone-900"
              >
                Change lessons
              </button>
            )}
          </div>
        </div>
      )}

      {!done && current && (
        <>
          <div
            className="mt-4 flex min-h-[160px] w-full flex-col items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-8 text-center shadow-sm dark:border-stone-600 dark:bg-stone-900"
            aria-live="polite"
          >
            <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {flipped
                ? answerSide === "english"
                  ? "English"
                  : "Latin"
                : promptSide === "latin"
                  ? "Latin"
                  : "English"}
            </span>
            <span
              className={
                flipped
                  ? answerSide === "latin"
                    ? "font-serif text-3xl font-semibold leading-snug text-stone-900 dark:text-stone-50 sm:text-4xl"
                    : "text-xl leading-snug text-stone-800 dark:text-stone-100 sm:text-2xl"
                  : promptSide === "latin"
                    ? "font-serif text-3xl font-semibold leading-snug text-stone-900 dark:text-stone-50 sm:text-4xl"
                    : "text-xl leading-snug text-stone-800 dark:text-stone-100 sm:text-2xl"
              }
            >
              {flipped ? displayAnswer : displayPrompt}
            </span>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="w-full rounded-lg border-2 border-violet-600 bg-white px-4 py-3 text-sm font-semibold text-violet-900 hover:bg-violet-50 dark:border-violet-500 dark:bg-stone-900 dark:text-violet-100"
            >
              {flipped
                ? direction === "L2E"
                  ? "Show Latin again"
                  : "Show English again"
                : direction === "L2E"
                  ? "Flip — show English"
                  : "Flip — show Latin"}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-stone-500">
              {flipped
                ? "Mark how you did — then the next card appears."
                : direction === "L2E"
                  ? "Recall the English, then flip to check."
                  : "Recall the Latin, then flip to check."}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!flipped}
              onClick={() => grade("know")}
              className="rounded-lg bg-emerald-800 px-3 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Got it right
            </button>
            <button
              type="button"
              disabled={!flipped}
              onClick={() => grade("again")}
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-950 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
            >
              Got it wrong
            </button>
          </div>
          {!flipped && (
            <p className="mt-2 text-center text-[11px] text-stone-400">
              Flip first, then mark right or wrong.
            </p>
          )}

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={removeCurrentFromStack}
              className="text-xs text-stone-500 underline-offset-2 hover:text-rose-700 hover:underline"
            >
              Remove this card from stack
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "neutral";
}) {
  const colors =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="font-serif text-2xl font-bold">{value}</p>
    </div>
  );
}
