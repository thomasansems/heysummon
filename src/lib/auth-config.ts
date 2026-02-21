import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// Feature flags — control which login methods are available
export const AUTH_FLAGS = {
  formLogin: process.env.ENABLE_FORM_LOGIN !== "false", // default: true
  magicLink: process.env.ENABLE_MAGIC_LINK_LOGIN === "true", // default: false (needs LOOPS_API_KEY)
  google: process.env.ENABLE_GOOGLE_LOGIN === "true", // default: false (needs credentials)
  github: process.env.ENABLE_GITHUB_LOGIN === "true", // default: false (needs credentials)
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [];

// ─── Form Login (email + password) ───
// Works out of the box, no external services needed
if (AUTH_FLAGS.formLogin) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    })
  );
}

// ─── GitHub OAuth ───
if (AUTH_FLAGS.github && process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

// ─── Google OAuth ───
if (AUTH_FLAGS.google && process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    })
  );
}

// ─── Magic Link (email) ───
if (AUTH_FLAGS.magicLink && process.env.LOOPS_API_KEY) {
  providers.push(
    Email({
      server: {
        host: "smtp.example.com",
        port: 587,
        auth: { user: "", pass: "" },
      },
      from: "HeySummon <noreply@heysummon.ai>",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const LOOPS_API_KEY = process.env.LOOPS_API_KEY!;
        const res = await fetch("https://app.loops.so/api/v1/transactional", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOOPS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionalId: process.env.LOOPS_MAGIC_LINK_ID || process.env.LOOPS_TRANSACTIONAL_ID,
            email,
            dataVariables: { magic_link: url, login_url: url },
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("[Auth] Magic link send failed:", err);
          throw new Error("Failed to send magic link email");
        }
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    // Credentials provider requires JWT strategy (no DB sessions)
    strategy: AUTH_FLAGS.formLogin ? "jwt" : "database",
  },
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verify",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        // JWT strategy uses token, database strategy uses user
        session.user.id = (token?.id as string) || user?.id;
      }
      return session;
    },
  },
});
