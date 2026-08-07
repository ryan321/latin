"use client";

import { useMemo, useRef, useState } from "react";
import type {
  Activity,
  AnswerStatus,
  ParadigmGridPayload,
  MultipleChoicePayload,
  MatchingPayload,
  OrderingPayload,
  MultiSelectPayload,
  ClozePayload,
} from "@/types/activity";
import { LatinKeyboard } from "@/components/latin-keyboard/LatinKeyboard";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  activity: Activity;
  lessonSlug: string;
  initialStatus?: AnswerStatus | null;
  initialFeedback?: string | null;
  onGraded?: (result: {
    status: AnswerStatus;
    feedback: string;
    standardMet: boolean;
    progress?: { met: boolean; detail: string }[];
  }) => void;
};

const STATUS_STYLE: Record<AnswerStatus, string> = {
  pending:
    "border border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  partial:
    "border border-yellow-400/40 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200",
  passed:
    "border border-emerald-400/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const STATUS_LABEL: Record<AnswerStatus, string> = {
  pending: "Try again",
  partial: "Almost",
  passed: "Meets standard",
};

/**
 * Deterministic shuffle so SSR HTML matches the client (no Math.random).
 * Same seed → same order on server and browser.
 */
function seededShuffle<T>(arr: T[] | null | undefined, seed: string): T[] {
  if (!Array.isArray(arr)) return [];
  const a = [...arr];
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
  }
  s = s >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function asMatchingPayload(payload: unknown): MatchingPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<MatchingPayload>;
  if (!Array.isArray(p.left) || !Array.isArray(p.right)) return null;
  if (!p.pairs || typeof p.pairs !== "object") return null;
  return {
    left: p.left,
    right: p.right,
    pairs: p.pairs as Record<string, string>,
    leftLabel: p.leftLabel,
    rightLabel: p.rightLabel,
  };
}

function asOrderingPayload(payload: unknown): OrderingPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<OrderingPayload>;
  if (!Array.isArray(p.items) || !Array.isArray(p.correctOrder)) return null;
  return {
    items: p.items,
    correctOrder: p.correctOrder,
  };
}

type FocusTarget =
  | { kind: "text" }
  | { kind: "cell"; id: string }
  | { kind: "blank"; id: string }
  | null;

const NEEDS_MACRON_KB = new Set([
  "paradigm_grid",
  "single_form",
  "cloze",
  "translate",
]);

export function ActivityCard({
  activity,
  lessonSlug,
  initialStatus = null,
  initialFeedback = null,
  onGraded,
}: Props) {
  const [status, setStatus] = useState<AnswerStatus | null>(initialStatus);
  const [feedback, setFeedback] = useState<string | null>(initialFeedback);
  const [busy, setBusy] = useState(false);
  const [cellResults, setCellResults] = useState<Record<string, boolean>>({});

  const [text, setText] = useState("");
  const [optionId, setOptionId] = useState("");
  const [cells, setCells] = useState<Record<string, string>>(() => {
    if (activity.type === "paradigm_grid") {
      const p = activity.payload as ParadigmGridPayload;
      return { ...(p.prefill ?? {}) };
    }
    return {};
  });

  const [matchPairs, setMatchPairs] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clozeBlanks, setClozeBlanks] = useState<Record<string, string>>({});
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);

  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const blankRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const orderingPayload =
    activity.type === "ordering" ? asOrderingPayload(activity.payload) : null;
  const [order, setOrder] = useState<string[]>(() =>
    orderingPayload
      ? seededShuffle(
          orderingPayload.items.map((i) => i.id),
          `${activity.id}:order`
        )
      : []
  );

  const matchingPayload =
    activity.type === "matching" ? asMatchingPayload(activity.payload) : null;
  const shuffledRight = useMemo(
    () => seededShuffle(matchingPayload?.right, `${activity.id}:match`),
    // payload identity is stable per activity id from server props
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity.id]
  );

  function insertChar(char: string) {
    if (focusTarget?.kind === "text") {
      const el = textRef.current;
      if (el) {
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const next = text.slice(0, start) + char + text.slice(end);
        setText(next);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + char.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        setText(text + char);
      }
      return;
    }
    if (focusTarget?.kind === "cell") {
      const id = focusTarget.id;
      const el = cellRefs.current[id];
      const cur = cells[id] ?? "";
      if (el) {
        const start = el.selectionStart ?? cur.length;
        const end = el.selectionEnd ?? cur.length;
        const next = cur.slice(0, start) + char + cur.slice(end);
        setCells({ ...cells, [id]: next });
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + char.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        setCells({ ...cells, [id]: cur + char });
      }
      return;
    }
    if (focusTarget?.kind === "blank") {
      const id = focusTarget.id;
      const el = blankRefs.current[id];
      const cur = clozeBlanks[id] ?? "";
      if (el) {
        const start = el.selectionStart ?? cur.length;
        const end = el.selectionEnd ?? cur.length;
        const next = cur.slice(0, start) + char + cur.slice(end);
        setClozeBlanks({ ...clozeBlanks, [id]: next });
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + char.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        setClozeBlanks({ ...clozeBlanks, [id]: cur + char });
      }
      return;
    }
    // No field focused yet — default targets
    if (activity.type === "single_form" || activity.type === "translate") {
      setText(text + char);
      setFocusTarget({ kind: "text" });
    } else if (activity.type === "paradigm_grid") {
      const p = activity.payload as ParadigmGridPayload;
      const first =
        Object.keys(p.cells).find((id) => !p.prefill?.[id]) ??
        Object.keys(p.cells)[0];
      if (first) {
        setCells({ ...cells, [first]: (cells[first] ?? "") + char });
        setFocusTarget({ kind: "cell", id: first });
      }
    } else if (activity.type === "cloze") {
      const p = activity.payload as ClozePayload;
      const first = Object.keys(p.blanks)[0];
      if (first) {
        setClozeBlanks({
          ...clozeBlanks,
          [first]: (clozeBlanks[first] ?? "") + char,
        });
        setFocusTarget({ kind: "blank", id: first });
      }
    }
  }

  async function submit(response: unknown) {
    setBusy(true);
    setFeedback("Checking…");
    try {
      const res = await fetch("/api/activities/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonSlug,
          activityId: activity.id,
          response,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grade failed");
      setStatus(data.status);
      setFeedback(data.feedback);
      if (data.cellResults) setCellResults(data.cellResults);
      onGraded?.({
        status: data.status,
        feedback: data.feedback,
        standardMet: data.standardMet,
        progress: data.progress?.requirements?.map(
          (r: { met: boolean; detail: string }) => ({
            met: r.met,
            detail: r.detail,
          })
        ),
      });
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Grade failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  function buildResponse(): unknown {
    switch (activity.type) {
      case "paradigm_grid":
        return cells;
      case "multiple_choice":
        return { optionId };
      case "matching":
        return { pairs: matchPairs };
      case "ordering":
        return { order };
      case "multi_select":
        return { optionIds: selectedIds };
      case "cloze":
        return { blanks: clozeBlanks };
      default:
        return { text };
    }
  }

  const locked = status === "passed";
  const showKeyboard = NEEDS_MACRON_KB.has(activity.type) && !locked;

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
          {activity.prompt}
          {activity.source === "generated" && (
            <span className="ml-2 text-xs font-normal text-stone-500">
              (extra practice)
            </span>
          )}
        </p>
        {status && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {activity.type === "paradigm_grid" && (
        <ParadigmGridEditor
          payload={activity.payload as ParadigmGridPayload}
          cells={cells}
          setCells={setCells}
          cellResults={cellResults}
          disabled={locked || busy}
          cellRefs={cellRefs}
          onFocusCell={(id) => setFocusTarget({ kind: "cell", id })}
        />
      )}

      {(activity.type === "single_form" ||
        activity.type === "translate" ||
        activity.type === "short_answer") && (
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocusTarget({ kind: "text" })}
          rows={activity.type === "translate" ? 3 : 2}
          disabled={locked || busy}
          placeholder={
            activity.type === "translate"
              ? "Your translation…"
              : "Your answer…"
          }
          className="mt-1 w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      )}

      {activity.type === "multiple_choice" && (
        <ul className="mt-2 space-y-2">
          {(activity.payload as MultipleChoicePayload).options.map((opt) => (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-800 dark:text-stone-200">
                <input
                  type="radio"
                  name={activity.id}
                  value={opt.id}
                  checked={optionId === opt.id}
                  disabled={locked || busy}
                  onChange={() => setOptionId(opt.id)}
                  className="mt-1"
                />
                <span>{opt.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {activity.type === "matching" &&
        (matchingPayload ? (
          <MatchingEditor
            payload={matchingPayload}
            rightOptions={
              shuffledRight.length > 0 ? shuffledRight : matchingPayload.right
            }
            pairs={matchPairs}
            setPairs={setMatchPairs}
            cellResults={cellResults}
            disabled={locked || busy}
          />
        ) : (
          <p className="text-sm text-rose-600">
            This matching activity is missing left/right options in content.
          </p>
        ))}

      {activity.type === "ordering" &&
        (orderingPayload ? (
          <OrderingEditor
            payload={orderingPayload}
            order={order.length ? order : orderingPayload.items.map((i) => i.id)}
            setOrder={setOrder}
            cellResults={cellResults}
            disabled={locked || busy}
          />
        ) : (
          <p className="text-sm text-rose-600">
            This ordering activity is missing items in content.
          </p>
        ))}

      {activity.type === "multi_select" && (
        <ul className="mt-2 space-y-2">
          {(activity.payload as MultiSelectPayload).options.map((opt) => {
            const checked = selectedIds.includes(opt.id);
            return (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-800 dark:text-stone-200">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked || busy}
                    onChange={() => {
                      setSelectedIds((ids) =>
                        checked
                          ? ids.filter((x) => x !== opt.id)
                          : [...ids, opt.id]
                      );
                    }}
                    className="mt-1"
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {activity.type === "cloze" && (
        <ClozeEditor
          payload={activity.payload as ClozePayload}
          blanks={clozeBlanks}
          setBlanks={setClozeBlanks}
          cellResults={cellResults}
          disabled={locked || busy}
          blankRefs={blankRefs}
          onFocusBlank={(id) => setFocusTarget({ kind: "blank", id })}
        />
      )}

      {showKeyboard && (
        <LatinKeyboard
          className="mt-3"
          disabled={busy}
          onInsert={insertChar}
          compact={activity.type === "paradigm_grid"}
        />
      )}

      {feedback && (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            status === "passed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          }`}
        >
          {feedback}
        </p>
      )}

      {!locked && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(buildResponse())}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            {busy ? "Checking…" : "Check"}
          </button>
        </div>
      )}
    </li>
  );
}

function ParadigmGridEditor({
  payload,
  cells,
  setCells,
  cellResults,
  disabled,
  cellRefs,
  onFocusCell,
}: {
  payload: ParadigmGridPayload;
  cells: Record<string, string>;
  setCells: (c: Record<string, string>) => void;
  cellResults: Record<string, boolean>;
  disabled: boolean;
  cellRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFocusCell: (id: string) => void;
}) {
  const { rows, cols } = payload.labels;
  return (
    <div className="mt-2 overflow-x-auto">
      {payload.stem && (
        <p className="mb-2 text-xs text-stone-500">
          Stem: <span className="font-mono">{payload.stem}-</span>
        </p>
      )}
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-stone-200 p-1 text-left text-xs font-medium text-stone-500 dark:border-stone-700" />
            {cols.map((c) => (
              <th
                key={c}
                className="border border-stone-200 p-1 text-xs font-semibold uppercase text-stone-600 dark:border-stone-700 dark:text-stone-300"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th className="border border-stone-200 p-1 text-left text-xs font-semibold uppercase text-stone-600 dark:border-stone-700 dark:text-stone-300">
                {row}
              </th>
              {cols.map((col) => {
                const id = `${row}.${col}`;
                const prefilled = payload.prefill?.[id];
                const result = cellResults[id];
                const border =
                  result === true
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                    : result === false
                      ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                      : "border-stone-200 dark:border-stone-700";
                return (
                  <td key={id} className={`border p-0.5 ${border}`}>
                    <input
                      ref={(el) => {
                        cellRefs.current[id] = el;
                      }}
                      value={prefilled ?? cells[id] ?? ""}
                      disabled={disabled || !!prefilled}
                      onFocus={() => onFocusCell(id)}
                      onChange={(e) =>
                        setCells({ ...cells, [id]: e.target.value })
                      }
                      className="w-full bg-transparent px-1.5 py-1 font-mono text-sm text-stone-900 outline-none disabled:opacity-70 dark:text-stone-100"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchingEditor({
  payload,
  rightOptions,
  pairs,
  setPairs,
  cellResults,
  disabled,
}: {
  payload: MatchingPayload;
  rightOptions: { id: string; label: string }[];
  pairs: Record<string, string>;
  setPairs: (p: Record<string, string>) => void;
  cellResults: Record<string, boolean>;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <span>{payload.leftLabel ?? "Match"}</span>
        <span>{payload.rightLabel ?? "With"}</span>
      </div>
      {payload.left.map((left) => {
        const result = cellResults[left.id];
        const border =
          result === true
            ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
            : result === false
              ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
              : "border-stone-200 dark:border-stone-700";
        return (
          <div
            key={left.id}
            className={`grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-2 ${border}`}
          >
            <p className="flex items-center text-sm text-stone-800 dark:text-stone-200">
              {left.label}
            </p>
            <select
              value={pairs[left.id] ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setPairs({ ...pairs, [left.id]: e.target.value })
              }
              className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
            >
              <option value="">— choose —</option>
              {rightOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function OrderingEditor({
  payload,
  order,
  setOrder,
  cellResults,
  disabled,
}: {
  payload: OrderingPayload;
  order: string[];
  setOrder: (o: string[]) => void;
  cellResults: Record<string, boolean>;
  disabled: boolean;
}) {
  const byId = new Map(payload.items.map((i) => [i.id, i.label]));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Avoid hijacking taps on ↑↓ buttons
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      // Short press + slight move works well on iPad/phone
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= order.length) return;
    setOrder(arrayMove(order, index, next));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  }

  return (
    <div className="mt-2">
      <p className="mb-2 text-xs text-stone-500">
        Drag to reorder
        <span className="hidden sm:inline"> (or use ↑ ↓)</span>
        <span className="sm:hidden"> — press and hold, then drag</span>
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={disabled ? undefined : onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {order.map((id, index) => (
              <SortableOrderItem
                key={id}
                id={id}
                index={index}
                label={byId.get(id) ?? id}
                result={cellResults[id]}
                disabled={disabled}
                isFirst={index === 0}
                isLast={index === order.length - 1}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableOrderItem({
  id,
  index,
  label,
  result,
  disabled,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  index: number;
  label: string;
  result?: boolean;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const border =
    result === true
      ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
      : result === false
        ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
        : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm shadow-sm touch-none ${border} ${
        isDragging ? "ring-2 ring-amber-500/50 shadow-md" : ""
      }`}
    >
      {!disabled && (
        <button
          type="button"
          className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 active:cursor-grabbing dark:hover:bg-stone-800"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <DragHandleIcon />
        </button>
      )}
      <span className="w-5 shrink-0 text-xs font-bold text-stone-400">
        {index + 1}.
      </span>
      <span className="flex-1 select-none text-stone-800 dark:text-stone-200">
        {label}
      </span>
      {!disabled && (
        <span className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded border border-stone-300 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-stone-600"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded border border-stone-300 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-stone-600"
            aria-label="Move down"
          >
            ↓
          </button>
        </span>
      )}
    </li>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}

function ClozeEditor({
  payload,
  blanks,
  setBlanks,
  cellResults,
  disabled,
  blankRefs,
  onFocusBlank,
}: {
  payload: ClozePayload;
  blanks: Record<string, string>;
  setBlanks: (b: Record<string, string>) => void;
  cellResults: Record<string, boolean>;
  disabled: boolean;
  blankRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFocusBlank: (id: string) => void;
}) {
  const parts = payload.template.split(/(\{\{\d+\}\})/g);

  return (
    <div className="mt-2 space-y-3">
      <p className="flex flex-wrap items-center gap-1 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) {
            return (
              <span key={i} className="font-serif">
                {part}
              </span>
            );
          }
          const id = m[1]!;
          const result = cellResults[id];
          const border =
            result === true
              ? "border-emerald-400 bg-emerald-50"
              : result === false
                ? "border-rose-400 bg-rose-50"
                : "border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-950";
          return (
            <input
              key={i}
              ref={(el) => {
                blankRefs.current[id] = el;
              }}
              value={blanks[id] ?? ""}
              disabled={disabled}
              onFocus={() => onFocusBlank(id)}
              onChange={(e) => setBlanks({ ...blanks, [id]: e.target.value })}
              className={`mx-0.5 w-24 rounded border px-1.5 py-0.5 text-center font-mono text-sm outline-none focus:ring-1 focus:ring-amber-700 ${border}`}
              aria-label={`Blank ${id}`}
              autoComplete="off"
              spellCheck={false}
            />
          );
        })}
      </p>
      {payload.wordBank && payload.wordBank.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="w-full text-xs font-semibold uppercase text-stone-400">
            Word bank
          </span>
          {payload.wordBank.map((w) => (
            <button
              key={w}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const empty = Object.keys(payload.blanks).find(
                  (id) => !(blanks[id] ?? "").trim()
                );
                if (empty) setBlanks({ ...blanks, [empty]: w });
              }}
              className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 font-mono text-xs text-stone-700 hover:border-amber-600 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-200"
            >
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
