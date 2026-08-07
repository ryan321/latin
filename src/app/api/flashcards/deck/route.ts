import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { flashcardProgress } from "@/db/schema";
import {
  extractCardsFromLessonSlugs,
  sortDeckForPractice,
  type Flashcard,
} from "@/lib/flashcards/extract";
import { listAllLessons } from "@/lib/content";

function isWeak(s: {
  correctCount: number;
  wrongCount: number;
  lastResult: string | null;
  streak: number;
}): boolean {
  if (s.wrongCount === 0 && s.correctCount === 0) return false;
  if (s.lastResult === "again") return true;
  if (s.wrongCount > s.correctCount) return true;
  const total = s.correctCount + s.wrongCount;
  if (total >= 2 && s.correctCount / total < 0.6) return true;
  if (s.streak === 0 && s.wrongCount > 0) return true;
  return false;
}

/** All Latin→English cards from every vocab-* lesson. */
function allVocabLessonSlugs(): string[] {
  return listAllLessons()
    .filter(
      (l) =>
        l.slug.startsWith("vocab-") ||
        /^vocabulary/i.test(l.title) ||
        l.title.toLowerCase().includes("vocabulary quiz")
    )
    .map((l) => l.slug);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "lessons"; // lessons | weak
  const lessonsParam = url.searchParams.get("lessons") ?? "";
  let slugs = lessonsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (mode === "weak") {
    // Weak cards from progress; optional filter to selected vocab lessons
    const statsRows = await db
      .select()
      .from(flashcardProgress)
      .where(eq(flashcardProgress.userId, session.user.id));

    const weakRows = statsRows.filter((r) =>
      isWeak({
        correctCount: r.correctCount,
        wrongCount: r.wrongCount,
        lastResult: r.lastResult,
        streak: r.streak,
      })
    );

    if (weakRows.length === 0) {
      return NextResponse.json({
        cards: [],
        count: 0,
        mode: "weak",
        message:
          "No weak cards yet. Practice some vocab decks and mark a few wrong — they’ll show up here.",
      });
    }

    // If lessons specified, only keep cards that appear in those lessons
    let allowedKeys: Set<string> | null = null;
    if (slugs.length > 0) {
      const fromLessons = extractCardsFromLessonSlugs(slugs);
      allowedKeys = new Set(fromLessons.map((c) => c.key));
    }

    const cards: Flashcard[] = weakRows
      .filter((r) => !allowedKeys || allowedKeys.has(r.cardKey))
      .map((r) => ({
        key: r.cardKey,
        front: r.front,
        back: r.back,
        kind: "vocab" as const,
        sourceLesson: (r.sourceLessons ?? [])[0] ?? "practice",
      }));

    const stats = new Map(
      weakRows.map((r) => [
        r.cardKey,
        {
          correctCount: r.correctCount,
          wrongCount: r.wrongCount,
          streak: r.streak,
          lastResult: r.lastResult,
        },
      ])
    );

    const sorted = sortDeckForPractice(cards, stats);
    return NextResponse.json({
      cards: sorted,
      count: sorted.length,
      mode: "weak",
      lessons: slugs,
    });
  }

  // Default: cards from selected lessons
  if (slugs.length === 0) {
    return NextResponse.json(
      { cards: [], error: "No lessons selected" },
      { status: 400 }
    );
  }
  if (slugs.length > 40) {
    return NextResponse.json(
      { error: "Too many lessons (max 40)" },
      { status: 400 }
    );
  }

  // Safety: only vocab lessons on this endpoint for picker
  const vocabSet = new Set(allVocabLessonSlugs());
  slugs = slugs.filter((s) => vocabSet.has(s) || s.startsWith("vocab-"));
  if (slugs.length === 0) {
    return NextResponse.json(
      { cards: [], error: "Select at least one vocabulary lesson" },
      { status: 400 }
    );
  }

  const cards = extractCardsFromLessonSlugs(slugs);
  const keys = cards.map((c) => c.key);

  const statsRows =
    keys.length > 0
      ? await db
          .select()
          .from(flashcardProgress)
          .where(eq(flashcardProgress.userId, session.user.id))
      : [];

  const keySet = new Set(keys);
  const stats = new Map(
    statsRows
      .filter((r) => keySet.has(r.cardKey))
      .map((r) => [
        r.cardKey,
        {
          correctCount: r.correctCount,
          wrongCount: r.wrongCount,
          streak: r.streak,
          lastResult: r.lastResult,
        },
      ])
  );

  const onlyWeak = url.searchParams.get("onlyWeak") === "1";
  let deck = cards;
  if (onlyWeak) {
    deck = cards.filter((c) => {
      const s = stats.get(c.key);
      if (!s) return false; // never practiced → not "weak" yet
      return isWeak(s);
    });
  }

  const sorted = sortDeckForPractice(deck, stats);

  return NextResponse.json({
    cards: sorted,
    count: sorted.length,
    lessons: slugs,
    mode: onlyWeak ? "lessons-weak" : "lessons",
  });
}
