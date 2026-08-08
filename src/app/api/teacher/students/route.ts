import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isValidUsername, normalizeUsername, requireTeacher } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const createSchema = z.object({
  username: z.string().min(2).max(32),
  name: z.string().min(1).max(80),
  password: z.string().min(4).max(128),
  isTeacher: z.boolean().optional().default(false),
});

/** POST — create a student (or teacher) account */
export async function POST(req: Request) {
  const { error } = await requireTeacher();
  if (error) return error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const username = normalizeUsername(parsed.data.username);
  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username must be 2–32 characters: letters, numbers, _ or - only.",
      },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 }
    );
  }

  const passwordHash = await hash(parsed.data.password, 10);
  const [created] = await db
    .insert(users)
    .values({
      username,
      name: parsed.data.name.trim(),
      passwordHash,
      isTeacher: parsed.data.isTeacher ?? false,
    })
    .returning({
      id: users.id,
      username: users.username,
      name: users.name,
      isTeacher: users.isTeacher,
    });

  return NextResponse.json({ user: created }, { status: 201 });
}
