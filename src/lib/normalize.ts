/** Strip combining macron / breve and common spacing for form comparison. */
export function stripMacrons(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0304\u0306]/g, "") // macron, breve
    .normalize("NFC");
}

/** Normalize a Latin form for generous matching. */
export function normalizeLatin(s: string): string {
  return stripMacrons(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'");
}

export function normalizeEnglish(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

export function matchesAny(
  answer: string,
  accepted: string[],
  mode: "latin" | "english" = "latin"
): boolean {
  const norm = mode === "latin" ? normalizeLatin : normalizeEnglish;
  const a = norm(answer);
  if (!a) return false;
  return accepted.some((x) => norm(x) === a);
}
