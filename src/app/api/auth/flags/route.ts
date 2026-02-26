import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/flags — Returns which login methods are enabled
 * Used by the login page to show/hide buttons dynamically.
 * Also returns whether any users exist (for first-time setup flow).
 */
export async function GET() {
  const userCount = await prisma.user.count();

  const registrationOpen = userCount === 0 || process.env.ALLOW_REGISTRATION === "true";

  return NextResponse.json({
    formLogin: process.env.ENABLE_FORM_LOGIN !== "false",
    magicLink: process.env.ENABLE_MAGIC_LINK_LOGIN === "true" && !!process.env.LOOPS_API_KEY,
    google: process.env.ENABLE_GOOGLE_LOGIN === "true" && !!process.env.GOOGLE_ID,
    github: process.env.ENABLE_GITHUB_LOGIN === "true" && !!process.env.GITHUB_ID,
    hasUsers: userCount > 0,
    registrationOpen,
  });
}
