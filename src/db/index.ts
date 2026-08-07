/**
 * DB client. Works with:
 *   - Local Postgres (DATABASE_URL=postgresql://…@localhost/…)
 *   - Neon (pooled or direct connection string with sslmode=require)
 *
 * Uses postgres.js via drizzle-orm/postgres-js so one driver covers both.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

let _client: ReturnType<typeof postgres> | null = null;
let _db: Db | null = null;

function getClient() {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = postgres(url, { max: 10, prepare: false });
  }
  return _client;
}

export function getDb(): Db {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") return value.bind(real);
    return value;
  },
});
