import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
    Email({
      server: {
        // Not used — we override sendVerificationRequest
        host: "smtp.example.com",
        port: 587,
        auth: { user: "", pass: "" },
      },
      from: "HITLaaS <noreply@hitlaas.app>",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // Use Loops transactional API to send magic link
        const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

        if (!LOOPS_API_KEY) {
          console.error("[Auth] LOOPS_API_KEY not set — cannot send magic link");
          throw new Error("Email service not configured");
        }

        const res = await fetch("https://app.loops.so/api/v1/transactional", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOOPS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionalId: process.env.LOOPS_MAGIC_LINK_ID || process.env.LOOPS_TRANSACTIONAL_ID,
            email,
            dataVariables: {
              magic_link: url,
              login_url: url,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error("[Auth] Loops magic link send failed:", err);
          throw new Error("Failed to send magic link email");
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verify",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
