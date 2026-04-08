import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/flags — Returns which login methods are enabled
 * Used by the login page to show/hide buttons dynamically.
 * Also returns whether any users exist (for first-time setup flow).
 *
 * If the database is unreachable (e.g. misconfigured DATABASE_URL on a fresh
 * install), we still return the auth flags so the login page renders. The
 * `dbError` flag lets the client surface a clear setup error instead of
 * silently dropping into the login form.
 */
export async function GET() {
  const flags = {
    formLogin: process.env.ENABLE_FORM_LOGIN !== "false",
    magicLink: process.env.ENABLE_MAGIC_LINK_LOGIN === "true" && !!process.env.LOOPS_API_KEY,
    google: process.env.ENABLE_GOOGLE_LOGIN === "true" && !!process.env.GOOGLE_ID,
    github: process.env.ENABLE_GITHUB_LOGIN === "true" && !!process.env.GITHUB_ID,
  };

  try {
    const userCount = await prisma.user.count();
    const registrationOpen =
      userCount === 0 || process.env.ALLOW_REGISTRATION === "true";

    return NextResponse.json({
      ...flags,
      hasUsers: userCount > 0,
      registrationOpen,
      dbError: false,
    });
  } catch (err) {
    console.error("[auth/flags] database query failed:", err);
    return NextResponse.json({
      ...flags,
      hasUsers: false,
      registrationOpen: false,
      dbError: true,
    });
  }
}
