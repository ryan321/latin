"use client";

import { useCallback, useId, useState } from "react";

/** Characters the mini keyboard can insert. */
export const LATIN_MACRON_CHARS = [
  "ā",
  "ē",
  "ī",
  "ō",
  "ū",
  "ȳ",
  "Ā",
  "Ē",
  "Ī",
  "Ō",
  "Ū",
] as const;

type Props = {
  /** Called when the student taps a character. Parent inserts into the active field. */
  onInsert: (char: string) => void;
  disabled?: boolean;
  /** Compact = single row of lowercase only */
  compact?: boolean;
  className?: string;
};

/**
 * Small on-screen keyboard for classical Latin macrons (long vowels).
 * Pair with inputs that call onInsert, or use LatinKeyboardField wrapper.
 */
export function LatinKeyboard({
  onInsert,
  disabled,
  compact,
  className = "",
}: Props) {
  const lower = ["ā", "ē", "ī", "ō", "ū", "ȳ"] as const;
  const upper = ["Ā", "Ē", "Ī", "Ō", "Ū"] as const;

  return (
    <div
      className={`rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-950/80 ${className}`}
      role="group"
      aria-label="Latin long vowels"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Long vowels
        </span>
        <TypingHelpLink />
      </div>
      <div className="flex flex-wrap gap-1">
        {lower.map((ch) => (
          <KeyButton
            key={ch}
            char={ch}
            disabled={disabled}
            onInsert={onInsert}
          />
        ))}
      </div>
      {!compact && (
        <div className="mt-1 flex flex-wrap gap-1">
          {upper.map((ch) => (
            <KeyButton
              key={ch}
              char={ch}
              disabled={disabled}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KeyButton({
  char,
  disabled,
  onInsert,
}: {
  char: string;
  disabled?: boolean;
  onInsert: (c: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => {
        // Prevent stealing focus from the text field
        e.preventDefault();
        onInsert(char);
      }}
      className="min-w-[2rem] rounded-md border border-stone-300 bg-white px-2 py-1 font-serif text-base font-medium text-stone-900 shadow-sm hover:border-amber-600 hover:bg-amber-50 active:bg-amber-100 disabled:opacity-40 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-amber-500 dark:hover:bg-amber-950/40"
    >
      {char}
    </button>
  );
}

/** Inline link + expandable Mac / iPad keystroke help */
export function TypingHelpLink() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-400"
        aria-expanded={open}
        aria-controls={panelId}
      >
        Keyboard shortcuts
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close help"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-lg dark:border-stone-600 dark:bg-stone-900"
          >
            <TypingHelpContent />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-400"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TypingHelpContent() {
  return (
    <div className="space-y-3 text-xs leading-relaxed text-stone-700 dark:text-stone-300">
      <p className="font-semibold text-stone-900 dark:text-stone-100">
        Typing long vowels (macrons)
      </p>
      <p>
        Macrons are <strong>optional</strong> in most answers here — use them
        when you want. The buttons insert into the active field.
      </p>

      <div>
        <p className="font-semibold text-stone-800 dark:text-stone-200">
          Mac
        </p>
        <ol className="mt-1 list-decimal space-y-1 pl-4">
          <li>
            Enable <strong>ABC – Extended</strong> (or “U.S. Extended”): System
            Settings → Keyboard → Input Sources → + → ABC – Extended.
          </li>
          <li>
            Press <kbd className="kbd">Option</kbd> +{" "}
            <kbd className="kbd">a</kbd>, then the vowel:
          </li>
        </ol>
        <ul className="mt-1.5 space-y-0.5 rounded-md bg-stone-50 p-2 font-mono text-[11px] dark:bg-stone-950">
          <li>⌥a then a → ā</li>
          <li>⌥a then e → ē</li>
          <li>⌥a then i → ī</li>
          <li>⌥a then o → ō</li>
          <li>⌥a then u → ū</li>
          <li>⌥a then y → ȳ</li>
          <li>Shift after ⌥a for Ā Ē Ī Ō Ū</li>
        </ul>
      </div>

      <div>
        <p className="font-semibold text-stone-800 dark:text-stone-200">
          iPad / iPhone
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            <strong>Hold</strong> a vowel key (a, e, i, o, u) until the popup
            appears, then slide to the long form (ā, ē, …) if shown.
          </li>
          <li>
            Or Settings → General → Keyboard → Keyboards → Add New Keyboard →
            add a Latin-capable layout if available on your OS version.
          </li>
          <li>
            Easiest in this app: tap the <strong>long vowel buttons</strong>{" "}
            above the answer field.
          </li>
        </ul>
      </div>

      <div>
        <p className="font-semibold text-stone-800 dark:text-stone-200">
          Windows (optional)
        </p>
        <p className="mt-1">
          Use the character map, or install a Latin keyboard; in many setups{" "}
          <kbd className="kbd">Alt</kbd> codes or WinCompose help. Prefer the
          on-screen buttons in this app when practicing.
        </p>
      </div>
    </div>
  );
}

/**
 * Insert `char` into an input/textarea at the caret (or append).
 */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  char: string
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + char + el.value.slice(end);
  el.value = next;
  const pos = start + char.length;
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return next;
}

/** Hook-friendly insert helper for controlled React inputs */
export function useInsertChar(
  value: string,
  setValue: (v: string) => void,
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
) {
  return useCallback(
    (char: string) => {
      const el = inputRef.current;
      if (el && document.activeElement === el) {
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + char + value.slice(end);
        setValue(next);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + char.length;
          el.setSelectionRange(pos, pos);
        });
        return;
      }
      setValue(value + char);
    },
    [value, setValue, inputRef]
  );
}
