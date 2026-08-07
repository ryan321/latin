"use client";

import { useMemo, useState } from "react";
import {
  FlashcardPractice,
  type CardDirection,
} from "@/components/flashcards/FlashcardPractice";

type LessonOpt = { slug: string; title: string; order: number };
type UnitOpt = {
  unitSlug: string;
  unitTitle: string;
  order: number;
  lessons: LessonOpt[];
};

type DeckMode =
  | { kind: "lessons"; slugs: string[]; onlyWeak: boolean }
  | { kind: "weak"; slugs: string[] };

function DirectionPicker({
  value,
  onChange,
}: {
  value: CardDirection;
  onChange: (d: CardDirection) => void;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-950/50">
      <p className="text-xs font-semibold text-stone-700 dark:text-stone-200">
        Show first (before flip)
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5 dark:border-stone-600 dark:bg-stone-900">
          <button
            type="button"
            onClick={() => onChange("L2E")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              value === "L2E"
                ? "bg-violet-800 text-violet-50"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            }`}
          >
            Latin
          </button>
          <button
            type="button"
            onClick={() => onChange("E2L")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              value === "E2L"
                ? "bg-violet-800 text-violet-50"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            }`}
          >
            English
          </button>
        </div>
        <span className="text-xs text-stone-500">
          {value === "L2E"
            ? "Latin on front → English after flip"
            : "English on front → Latin after flip"}
        </span>
      </div>
    </div>
  );
}

export function FlashcardPicker({ catalog }: { catalog: UnitOpt[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const [deckMode, setDeckMode] = useState<DeckMode | null>(null);
  const [direction, setDirection] = useState<CardDirection>("L2E");
  const [filter, setFilter] = useState("");

  const allVocabSlugs = useMemo(
    () => catalog.flatMap((u) => u.lessons.map((l) => l.slug)),
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog
      .map((u) => ({
        ...u,
        lessons: u.lessons.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.slug.toLowerCase().includes(q) ||
            u.unitTitle.toLowerCase().includes(q)
        ),
      }))
      .filter((u) => u.lessons.length > 0);
  }, [catalog, filter]);

  function toggle(slug: string) {
    setStarted(false);
    setDeckMode(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleUnit(u: UnitOpt) {
    setStarted(false);
    setDeckMode(null);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = u.lessons.every((l) => next.has(l.slug));
      for (const l of u.lessons) {
        if (allOn) next.delete(l.slug);
        else next.add(l.slug);
      }
      return next;
    });
  }

  function selectAll() {
    setStarted(false);
    setDeckMode(null);
    setSelected(new Set(allVocabSlugs));
  }

  function clear() {
    setSelected(new Set());
    setStarted(false);
    setDeckMode(null);
  }

  const slugs = [...selected];

  function buildSelected(onlyWeak: boolean) {
    if (slugs.length === 0) return;
    setDeckMode({ kind: "lessons", slugs, onlyWeak });
    setStarted(true);
  }

  function buildWeakAll() {
    setDeckMode({ kind: "weak", slugs: [] });
    setStarted(true);
  }

  function buildWeakFromSelected() {
    if (slugs.length === 0) return;
    setDeckMode({ kind: "weak", slugs });
    setStarted(true);
  }

  const practiceKey = deckMode
    ? `${direction}:${
        deckMode.kind === "weak"
          ? `weak:${deckMode.slugs.slice().sort().join(",")}`
          : `lessons:${deckMode.onlyWeak ? "w:" : ""}${deckMode.slugs.slice().sort().join(",")}`
      }`
    : "";

  return (
    <div className="space-y-6">
      {/* Direction — pick before building */}
      <DirectionPicker value={direction} onChange={setDirection} />

      {/* Quick actions */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900 dark:bg-violet-950/30">
        <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
          Quick practice
        </p>
        <p className="mt-1 text-xs text-violet-900/70 dark:text-violet-300/80">
          Jump straight into words you’ve often marked wrong (from any past
          flashcard practice). Uses the direction above.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={buildWeakAll}
            className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-900"
          >
            Words I’m weak on
          </button>
          {slugs.length > 0 && (
            <button
              type="button"
              onClick={buildWeakFromSelected}
              className="rounded-lg border border-violet-400 bg-white px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-50 dark:border-violet-700 dark:bg-stone-900 dark:text-violet-100"
            >
              Weak only from selected ({slugs.length})
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter vocabulary lessons…"
            className="min-w-[12rem] flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
          />
          <button
            type="button"
            onClick={selectAll}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 dark:border-stone-600 dark:text-stone-200"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={slugs.length === 0}
            onClick={() => buildSelected(false)}
            className="rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-900 disabled:opacity-40"
          >
            Build deck ({slugs.length})
          </button>
          <button
            type="button"
            disabled={slugs.length === 0}
            onClick={() => buildSelected(true)}
            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            title="Only cards from the selected lessons that you’ve often missed"
          >
            Weak in selected
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 dark:border-stone-600 dark:text-stone-300"
            >
              Clear
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-stone-500">
          Vocabulary lessons only ({allVocabSlugs.length} available). Choose
          Latin or English first above, check lists, then build.
        </p>

        <ul className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {filtered.map((u) => {
            const allOn = u.lessons.every((l) => selected.has(l.slug));
            const some = u.lessons.some((l) => selected.has(l.slug));
            return (
              <li key={u.unitSlug}>
                <div className="mb-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleUnit(u)}
                    className="text-left text-xs font-bold uppercase tracking-wide text-stone-500 hover:text-violet-800 dark:hover:text-violet-300"
                  >
                    {allOn ? "☑" : some ? "☒" : "☐"} {u.unitTitle}
                  </button>
                </div>
                <ul className="space-y-1 border-l border-stone-200 pl-3 dark:border-stone-700">
                  {u.lessons.map((l) => (
                    <li key={l.slug}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-stone-50 dark:hover:bg-stone-800/80">
                        <input
                          type="checkbox"
                          checked={selected.has(l.slug)}
                          onChange={() => toggle(l.slug)}
                          className="rounded border-stone-300"
                        />
                        <span className="text-stone-800 dark:text-stone-200">
                          {l.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-sm text-stone-500">No vocabulary lessons match.</li>
          )}
        </ul>
      </div>

      {started && deckMode && (
        <FlashcardPractice
          key={practiceKey}
          initialDirection={direction}
          deckQuery={
            deckMode.kind === "weak"
              ? {
                  mode: "weak",
                  lessons: deckMode.slugs,
                }
              : {
                  mode: "lessons",
                  lessons: deckMode.slugs,
                  onlyWeak: deckMode.onlyWeak,
                }
          }
          title={
            deckMode.kind === "weak"
              ? deckMode.slugs.length
                ? "Weak words (from selection)"
                : "Words I’m weak on"
              : deckMode.onlyWeak
                ? "Weak words in selected lessons"
                : "Your vocab deck"
          }
          subtitle={
            deckMode.kind === "weak"
              ? `${direction === "L2E" ? "Latin → English" : "English → Latin"}. Hardest first.`
              : `${direction === "L2E" ? "Latin → English" : "English → Latin"} · ${deckMode.slugs.length} vocabulary lesson${deckMode.slugs.length === 1 ? "" : "s"}`
          }
          onChangeLessons={() => {
            setStarted(false);
            setDeckMode(null);
          }}
        />
      )}
    </div>
  );
}
