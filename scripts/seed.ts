import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const email = (process.env.SEED_EMAIL ?? "student@local.test").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "latin-learn";
  const name = process.env.SEED_NAME ?? "Student";

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const passwordHash = await hash(password, 10);
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({ passwordHash, name })
      .where(eq(users.email, email));
    console.log(`Updated user ${email}`);
  } else {
    await db.insert(users).values({
      email,
      name,
      passwordHash,
      isTeacher: true,
    });
    console.log(`Created user ${email}`);
  }

  console.log(`Password: ${password}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
