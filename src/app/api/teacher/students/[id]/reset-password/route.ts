import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const bodySchema = z.object({
  password: z.string().min(4).max(128),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error } = await requireTeacher();
  if (error) return error;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters." },
      { status: 400 }
    );
  }

  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordHash = await hash(parsed.data.password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));

  return NextResponse.json({
    ok: true,
    username: user.username,
  });
}
