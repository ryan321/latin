import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Unique cookie names so Auth.js JWTs from other localhost apps
 * (cookies are often shared across ports) don't collide.
 */
const COOKIE = "latin-year1";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            console.warn("[auth] missing username or password");
            return null;
          }

          const username = normalizeUsername(String(credentials.username));
          const password = String(credentials.password);

          if (!username) {
            console.warn("[auth] empty username");
            return null;
          }

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);

          if (!user?.passwordHash) {
            console.warn("[auth] no user for", username);
            return null;
          }

          const valid = await compare(password, user.passwordHash);
          if (!valid) {
            console.warn("[auth] bad password for", username);
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            // stash extras on the user object for jwt callback
            username: user.username,
            isTeacher: user.isTeacher,
          } as {
            id: string;
            name: string;
            username: string;
            isTeacher: boolean;
          };
        } catch (err) {
          console.error("[auth] authorize error", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name: `${COOKIE}.session-token`,
    },
    callbackUrl: {
      name: `${COOKIE}.callback-url`,
    },
    csrfToken: {
      name: `${COOKIE}.csrf-token`,
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        const u = user as {
          username?: string;
          isTeacher?: boolean;
        };
        if (typeof u.username === "string") token.username = u.username;
        if (typeof u.isTeacher === "boolean") token.isTeacher = u.isTeacher;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.username === "string") {
          session.user.username = token.username;
        }
        session.user.isTeacher = Boolean(token.isTeacher);
      }
      return session;
    },
  },
});

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Allowed: letters, numbers, underscore, hyphen; 2–32 chars */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]{2,32}$/.test(username);
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null as null,
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null as null };
}

export async function requireTeacher() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null as null,
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!session.user.isTeacher) {
    return {
      session: null as null,
      error: Response.json({ error: "Teacher only" }, { status: 403 }),
    };
  }
  return { session, error: null as null };
}
