import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { flashcardProgress } from "@/db/schema";

const bodySchema = z.object({
  cardKey: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  result: z.enum(["know", "again"]),
  sourceLesson: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { cardKey, front, back, result, sourceLesson } = parsed.data;
  const userId = session.user.id;

  const [existing] = await db
    .select()
    .from(flashcardProgress)
    .where(
      and(
        eq(flashcardProgress.userId, userId),
        eq(flashcardProgress.cardKey, cardKey)
      )
    )
    .limit(1);

  const now = new Date();
  if (!existing) {
    const sources = sourceLesson ? [sourceLesson] : [];
    await db.insert(flashcardProgress).values({
      userId,
      cardKey,
      front,
      back,
      sourceLessons: sources,
      correctCount: result === "know" ? 1 : 0,
      wrongCount: result === "again" ? 1 : 0,
      streak: result === "know" ? 1 : 0,
      lastResult: result,
      lastSeenAt: now,
      updatedAt: now,
    });
  } else {
    const sources = new Set(existing.sourceLessons ?? []);
    if (sourceLesson) sources.add(sourceLesson);
    await db
      .update(flashcardProgress)
      .set({
        front,
        back,
        sourceLessons: [...sources],
        correctCount:
          existing.correctCount + (result === "know" ? 1 : 0),
        wrongCount: existing.wrongCount + (result === "again" ? 1 : 0),
        streak: result === "know" ? existing.streak + 1 : 0,
        lastResult: result,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(flashcardProgress.id, existing.id));
  }

  const [row] = await db
    .select()
    .from(flashcardProgress)
    .where(
      and(
        eq(flashcardProgress.userId, userId),
        eq(flashcardProgress.cardKey, cardKey)
      )
    )
    .limit(1);

  return NextResponse.json({
    ok: true,
    stats: row
      ? {
          correctCount: row.correctCount,
          wrongCount: row.wrongCount,
          streak: row.streak,
          lastResult: row.lastResult,
        }
      : null,
  });
}
