import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/db/schema";

/**
 * One-time-ish migration: email column → username if needed.
 */
async function ensureUsernameColumn(client: ReturnType<typeof postgres>) {
  await client`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
      ) THEN
        ALTER TABLE users RENAME COLUMN email TO username;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
      ) THEN
        ALTER TABLE users ADD COLUMN username text;
      END IF;
    END $$;
  `;

  // Strip email domains if any leftover
  await client`
    UPDATE users
    SET username = split_part(username, '@', 1)
    WHERE username LIKE '%@%';
  `;
  await client`
    UPDATE users SET username = lower(trim(username)) WHERE username IS NOT NULL;
  `;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const studentUsername = (
    process.env.SEED_USERNAME ??
    process.env.SEED_EMAIL?.split("@")[0] ??
    "student"
  )
    .toLowerCase()
    .trim();
  const studentPassword = process.env.SEED_PASSWORD ?? "latin-learn";
  const studentName = process.env.SEED_NAME ?? "Student";

  const teacherUsername = (
    process.env.SEED_TEACHER_USERNAME ?? "teacher"
  )
    .toLowerCase()
    .trim();
  const teacherPassword =
    process.env.SEED_TEACHER_PASSWORD ?? "latin-teach";
  const teacherName = process.env.SEED_TEACHER_NAME ?? "Teacher";

  const client = postgres(url, { max: 1 });
  await ensureUsernameColumn(client);

  const db = drizzle(client);

  async function upsertUser(opts: {
    username: string;
    name: string;
    password: string;
    isTeacher: boolean;
  }) {
    const passwordHash = await hash(opts.password, 10);
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, opts.username))
      .limit(1);

    if (existing[0]) {
      await db
        .update(users)
        .set({
          passwordHash,
          name: opts.name,
          isTeacher: opts.isTeacher,
        })
        .where(eq(users.username, opts.username));
      console.log(
        `Updated ${opts.isTeacher ? "teacher" : "student"} @${opts.username}`
      );
    } else {
      await db.insert(users).values({
        username: opts.username,
        name: opts.name,
        passwordHash,
        isTeacher: opts.isTeacher,
      });
      console.log(
        `Created ${opts.isTeacher ? "teacher" : "student"} @${opts.username}`
      );
    }
    console.log(`  password: ${opts.password}`);
  }

  await upsertUser({
    username: studentUsername,
    name: studentName,
    password: studentPassword,
    isTeacher: false,
  });

  await upsertUser({
    username: teacherUsername,
    name: teacherName,
    password: teacherPassword,
    isTeacher: true,
  });

  // Ensure is_teacher column exists (older DBs)
  await client`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_teacher'
      ) THEN
        ALTER TABLE users ADD COLUMN is_teacher boolean NOT NULL DEFAULT false;
      END IF;
    END $$;
  `;

  // Re-apply teacher flag after possible column add
  await db
    .update(users)
    .set({ isTeacher: true })
    .where(eq(users.username, teacherUsername));

  const count = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  console.log(`Users in DB: ${count[0]?.n ?? "?"}`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
