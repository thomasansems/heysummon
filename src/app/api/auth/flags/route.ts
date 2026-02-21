import { NextResponse } from "next/server";

/**
 * GET /api/auth/flags — Returns which login methods are enabled
 * Used by the login page to show/hide buttons dynamically.
 */
export async function GET() {
  return NextResponse.json({
    formLogin: process.env.ENABLE_FORM_LOGIN !== "false",
    magicLink: process.env.ENABLE_MAGIC_LINK_LOGIN === "true" && !!process.env.LOOPS_API_KEY,
    google: process.env.ENABLE_GOOGLE_LOGIN === "true" && !!process.env.GOOGLE_ID,
    github: process.env.ENABLE_GITHUB_LOGIN === "true" && !!process.env.GITHUB_ID,
  });
}
