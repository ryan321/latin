import type { ReactNode } from "react";

/**
 * Render inline emphasis in activity labels / lesson snippets.
 *
 * Supported markers (either style):
 *   **word**  → bold (preferred)
 *   __word__  → bold (same look; underscores accepted for authors)
 */
export function RichText({
  text,
  className = "font-bold text-amber-900 dark:text-amber-300",
}: {
  text: string;
  className?: string;
}): ReactNode {
  if (!text) return null;

  const nodes: ReactNode[] = [];
  // Non-greedy so multiple markers in one string work
  const re = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const word = match[1] ?? match[2] ?? "";
    nodes.push(
      <strong key={`e-${key++}`} className={className}>
        {word}
      </strong>
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  // If nothing matched, show plain text (no leftover marker handling needed)
  if (nodes.length === 0) return text;
  return <>{nodes}</>;
}
