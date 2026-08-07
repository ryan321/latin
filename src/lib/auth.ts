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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.warn("[auth] missing email or password");
            return null;
          }

          const email = String(credentials.email).toLowerCase().trim();
          const password = String(credentials.password);

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user?.passwordHash) {
            console.warn("[auth] no user for", email);
            return null;
          }

          const valid = await compare(password, user.passwordHash);
          if (!valid) {
            console.warn("[auth] bad password for", email);
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
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
      if (user?.id) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
});

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
