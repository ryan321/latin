"use client";

import { useState } from "react";
import type { Activity, AnswerStatus } from "@/types/activity";
import type { ParadigmGridPayload, MultipleChoicePayload } from "@/types/activity";

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

  // local response state by type
  const [text, setText] = useState("");
  const [optionId, setOptionId] = useState("");
  const [cells, setCells] = useState<Record<string, string>>(() => {
    if (activity.type === "paradigm_grid") {
      const p = activity.payload as ParadigmGridPayload;
      return { ...(p.prefill ?? {}) };
    }
    return {};
  });

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

  const locked = status === "passed";

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
        />
      )}

      {(activity.type === "single_form" ||
        activity.type === "translate" ||
        activity.type === "short_answer") && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
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
            onClick={() => {
              if (activity.type === "paradigm_grid") submit(cells);
              else if (activity.type === "multiple_choice")
                submit({ optionId });
              else submit({ text });
            }}
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
}: {
  payload: ParadigmGridPayload;
  cells: Record<string, string>;
  setCells: (c: Record<string, string>) => void;
  cellResults: Record<string, boolean>;
  disabled: boolean;
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
                      value={prefilled ?? cells[id] ?? ""}
                      disabled={disabled || !!prefilled}
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
