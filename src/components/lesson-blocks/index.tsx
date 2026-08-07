/**
 * MDX component palette for lesson teach bodies.
 *
 * Author in content/.../lessons/<slug>.mdx (or inline teach string):
 *
 *   <KeyTerm>nominative</KeyTerm>
 *   <Callout kind="remember">Macrons optional when typing answers.</Callout>
 *   <LatinExample latin="Puella in villā est." english="The girl is in the villa." />
 *   <ParadigmTable lemma="puella, puellae f." headers="Case|Singular|Plural"
 *     rows="Nominative|puella|puellae|Genitive|puellae|puellārum|Dative|puellae|puellīs|Accusative|puellam|puellās|Ablative|puellā|puellīs" />
 *   <EndingsStrip label="1st declension endings (sing.)" endings="a | ae | ae | am | ā" />
 *   <SoundCard letter="v" ipa="/w/" example="via" tip='like English "w"' />
 *   <CaseCards items="Nominative ~ subject|Accusative ~ direct object|Ablative ~ by/with/from; in + place where" />
 *   <Compare left="Classical" right="Ecclesiastical" rows="c always /k/ ~ c soft before e/i|v like w ~ v like English v" />
 *   <Steps steps="Learn the endings|Decline a new word|Translate a short sentence" />
 *   <MapCallout title="Italia">Rome sits on the Tiber in central Italy.</MapCallout>
 */
import type { ReactNode } from "react";
// React namespace for ExampleSentence keying
import React from "react";

function split(s: string | undefined, sep = "|"): string[] {
  if (!s) return [];
  return s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function KeyTerm({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-amber-400/25 px-1.5 py-0.5 font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
      {children}
    </span>
  );
}

export function Latin({ children }: { children: ReactNode }) {
  return (
    <span className="font-serif italic text-stone-900 dark:text-stone-100">
      {children}
    </span>
  );
}

const CALLOUT_STYLES: Record<string, string> = {
  note: "border-sky-400/50 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
  remember:
    "border-amber-400/50 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  try: "border-emerald-400/50 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning:
    "border-rose-400/50 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
  example:
    "border-violet-400/50 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100",
  culture:
    "border-orange-400/50 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
};

const CALLOUT_LABELS: Record<string, string> = {
  note: "Note",
  remember: "Remember",
  try: "Try this",
  warning: "Watch out",
  example: "Example",
  culture: "Roman world",
};

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: ReactNode;
}) {
  const styles = CALLOUT_STYLES[kind] ?? CALLOUT_STYLES.note;
  const label = title ?? CALLOUT_LABELS[kind] ?? "Note";
  return (
    <aside className={`my-5 rounded-lg border-l-4 px-4 py-3 ${styles}`}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <div className="text-sm leading-relaxed [&>p]:my-1">{children}</div>
    </aside>
  );
}

export function Image({
  src,
  alt = "",
  caption,
}: {
  src: string;
  alt?: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="mx-auto max-w-full rounded-lg border border-stone-200 dark:border-stone-700"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-stone-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function Video({
  src,
  poster,
  caption,
}: {
  src: string;
  poster?: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      <video
        src={src}
        poster={poster}
        controls
        className="mx-auto w-full max-w-full rounded-lg border border-stone-200 dark:border-stone-700"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-stone-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Latin + English example pair */
export function LatinExample({
  latin,
  english,
  note,
}: {
  latin: string;
  english?: string;
  note?: string;
}) {
  return (
    <figure className="my-5 overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50/40 dark:border-stone-700 dark:from-stone-900 dark:to-amber-950/20">
      <blockquote className="border-l-4 border-amber-700 px-4 py-3 font-serif text-lg italic text-stone-900 dark:border-amber-600 dark:text-stone-50">
        {latin}
      </blockquote>
      {english && (
        <p className="border-t border-stone-200/80 px-4 py-2 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300">
          {english}
        </p>
      )}
      {note && (
        <p className="border-t border-stone-200/80 px-4 py-2 text-xs text-stone-500 dark:border-stone-700">
          {note}
        </p>
      )}
    </figure>
  );
}

/**
 * Full paradigm table.
 * rows = pipe cells in row-major order matching headers columns.
 * headers = "Case|Singular|Plural"
 * rows = "Nominative|puella|puellae|Genitive|puellae|puellārum|..."
 */
export function ParadigmTable({
  lemma,
  title,
  headers = "Case|Singular|Plural",
  rows = "",
}: {
  lemma?: string;
  title?: string;
  headers?: string;
  rows?: string;
}) {
  const cols = split(headers);
  const cells = split(rows);
  const width = Math.max(cols.length, 1);
  const body: string[][] = [];
  for (let i = 0; i < cells.length; i += width) {
    body.push(cells.slice(i, i + width));
  }

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-stone-200 shadow-sm dark:border-stone-700">
      {(title || lemma) && (
        <figcaption className="border-b border-stone-200 bg-amber-900 px-4 py-2.5 text-center font-serif text-sm font-semibold text-amber-50 dark:border-stone-700 dark:bg-amber-950">
          {title ?? lemma}
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr className="bg-stone-100 dark:bg-stone-800">
              {cols.map((h) => (
                <th
                  key={h}
                  className="border-b border-stone-200 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-stone-600 dark:border-stone-700 dark:text-stone-300"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr
                key={ri}
                className={
                  ri % 2 === 0
                    ? "bg-white dark:bg-stone-900"
                    : "bg-stone-50 dark:bg-stone-900/60"
                }
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border-b border-stone-100 px-3 py-2 dark:border-stone-800 ${
                      ci === 0
                        ? "text-xs font-semibold uppercase text-stone-500"
                        : "font-serif text-base text-stone-900 dark:text-stone-100"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Horizontal chip strip of endings */
export function EndingsStrip({
  label,
  endings = "",
}: {
  label?: string;
  endings?: string;
}) {
  const parts = split(endings);
  return (
    <figure className="my-5">
      {label && (
        <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {label}
        </figcaption>
      )}
      <div className="flex flex-wrap gap-2">
        {parts.map((e, i) => (
          <span
            key={i}
            className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-1.5 font-mono text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          >
            -{e.replace(/^-/, "")}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Pronunciation flash card */
export function SoundCard({
  letter,
  ipa,
  example,
  tip,
}: {
  letter: string;
  ipa?: string;
  example?: string;
  tip?: string;
}) {
  return (
    <div className="my-3 flex gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-800 font-serif text-2xl font-bold text-amber-50 dark:bg-amber-700">
        {letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {ipa && (
            <span className="font-mono text-sm text-stone-500">{ipa}</span>
          )}
          {example && (
            <span className="font-serif italic text-stone-900 dark:text-stone-100">
              {example}
            </span>
          )}
        </div>
        {tip && (
          <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
            {tip}
          </p>
        )}
      </div>
    </div>
  );
}

/** Case role cards: "Nominative ~ subject of the verb|Accusative ~ direct object" */
export function CaseCards({ items = "" }: { items?: string }) {
  const cards = split(items).map((item) => {
    const [title, ...rest] = item.split("~").map((s) => s.trim());
    return { title: title ?? "", body: rest.join("~") };
  });
  return (
    <div className="my-5 grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-500">
            {c.title}
          </p>
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
            {c.body}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Two-column comparison */
export function Compare({
  left,
  right,
  rows = "",
}: {
  left: string;
  right: string;
  rows?: string;
}) {
  const pairs = split(rows).map((r) => {
    const [a, b] = r.split("~").map((s) => s.trim());
    return { a: a ?? "", b: b ?? "" };
  });
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
      <div className="grid grid-cols-2 divide-x divide-stone-200 bg-stone-100 text-center text-xs font-bold uppercase tracking-wide text-stone-600 dark:divide-stone-700 dark:bg-stone-800 dark:text-stone-300">
        <div className="px-3 py-2">{left}</div>
        <div className="px-3 py-2">{right}</div>
      </div>
      {pairs.map((p, i) => (
        <div
          key={i}
          className="grid grid-cols-2 divide-x divide-stone-100 border-t border-stone-100 text-sm dark:divide-stone-800 dark:border-stone-800"
        >
          <div className="px-3 py-2 text-stone-800 dark:text-stone-200">
            {p.a}
          </div>
          <div className="px-3 py-2 text-stone-800 dark:text-stone-200">
            {p.b}
          </div>
        </div>
      ))}
    </figure>
  );
}

/** Numbered process steps */
export function Steps({ steps = "" }: { steps?: string }) {
  const list = split(steps);
  return (
    <ol className="my-5 space-y-2">
      {list.map((s, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-800 text-xs font-bold text-amber-50">
            {i + 1}
          </span>
          <span className="pt-0.5 text-stone-800 dark:text-stone-200">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function MapCallout({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-5 rounded-xl border border-orange-300/50 bg-gradient-to-br from-orange-50 to-amber-50 p-4 dark:border-orange-900 dark:from-orange-950/40 dark:to-amber-950/30">
      <p className="text-[11px] font-bold uppercase tracking-wider text-orange-800/70 dark:text-orange-400/80">
        {title ?? "Roman world"}
      </p>
      <div className="mt-1 text-sm text-stone-800 dark:text-stone-200 [&>p]:my-1">
        {children}
      </div>
    </aside>
  );
}

/** Simple horizontal flow */
export function FlowChart({ steps = "" }: { steps?: string }) {
  const list = split(steps);
  return (
    <figure className="my-6 flex flex-wrap items-center justify-center gap-2">
      {list.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-sm font-medium text-stone-800 shadow-sm dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100">
            {s}
          </div>
          {i < list.length - 1 && (
            <span className="text-stone-400" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </figure>
  );
}

/** Side-by-side short vs long vowels (avoids fragile MDX markdown tables). */
export function VowelChart({
  title,
  short = "a|e|i|o|u",
  long = "ā|ē|ī|ō|ū",
  note,
}: {
  title?: string;
  short?: string;
  long?: string;
  note?: string;
}) {
  const s = split(short);
  const l = split(long);
  const n = Math.max(s.length, l.length);
  return (
    <figure className="not-prose my-5 overflow-hidden rounded-xl border border-stone-200 shadow-sm dark:border-stone-700">
      {title && (
        <figcaption className="border-b border-stone-200 bg-stone-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {title}
        </figcaption>
      )}
      <div className="grid grid-cols-2 divide-x divide-stone-200 dark:divide-stone-700">
        <div className="bg-stone-50/80 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
          Short
        </div>
        <div className="bg-amber-50/80 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300/80">
          Long (macron)
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-stone-200 dark:divide-stone-700">
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-4">
          {Array.from({ length: n }).map((_, i) => (
            <span
              key={`s-${i}`}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white font-serif text-xl text-stone-900 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
            >
              {s[i] ?? ""}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-50/30 px-3 py-4 dark:bg-amber-950/20">
          {Array.from({ length: n }).map((_, i) => (
            <span
              key={`l-${i}`}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/60 bg-white font-serif text-xl text-stone-900 dark:border-amber-800 dark:bg-stone-950 dark:text-stone-100"
            >
              {l[i] ?? ""}
            </span>
          ))}
        </div>
      </div>
      {note && (
        <p className="border-t border-stone-200 px-4 py-2 text-center text-xs text-stone-500 dark:border-stone-700">
          {note}
        </p>
      )}
    </figure>
  );
}

/** Chip row for diphthongs / letter groups */
export function LetterRow({
  label,
  letters = "",
}: {
  label?: string;
  letters?: string;
}) {
  const parts = split(letters);
  return (
    <div className="not-prose my-4">
      {label && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {parts.map((p) => (
          <span
            key={p}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-serif text-base font-semibold text-stone-900 shadow-sm dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Parts-of-speech glossary cards.
 * items = "Noun ~ Person, place, thing, or idea|Verb ~ Action or state of being|..."
 */
export function PosCards({ items = "" }: { items?: string }) {
  const cards = split(items).map((item) => {
    const [title, ...rest] = item.split("~").map((s) => s.trim());
    return { title: title ?? "", body: rest.join("~") };
  });
  return (
    <div className="not-prose my-5 grid gap-2 sm:grid-cols-2">
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <p className="font-serif text-base font-bold text-amber-900 dark:text-amber-400">
            {c.title}
          </p>
          <p className="mt-1 text-sm leading-snug text-stone-600 dark:text-stone-300">
            {c.body}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Example sentence with **bold** (or __bold__) markers on target words.
 * gloss = short analysis line below
 */
export function ExampleSentence({
  text = "",
  gloss,
}: {
  text?: string;
  gloss?: string;
}) {
  // Lazy import pattern avoided — keep renderer local for server MDX
  const nodes: React.ReactNode[] = [];
  const re = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const word = match[1] ?? match[2] ?? "";
    nodes.push(
      <strong
        key={key++}
        className="font-bold text-amber-900 dark:text-amber-300"
      >
        {word}
      </strong>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <figure className="not-prose my-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/80">
      <p className="text-[15px] leading-relaxed text-stone-900 dark:text-stone-100">
        {nodes.length ? nodes : text}
      </p>
      {gloss && (
        <figcaption className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-500 dark:border-stone-700">
          {gloss}
        </figcaption>
      )}
    </figure>
  );
}

export const lessonComponents = {
  KeyTerm,
  Latin,
  Callout,
  Image,
  Video,
  LatinExample,
  ParadigmTable,
  EndingsStrip,
  SoundCard,
  CaseCards,
  Compare,
  Steps,
  MapCallout,
  FlowChart,
  VowelChart,
  LetterRow,
  PosCards,
  ExampleSentence,
};
