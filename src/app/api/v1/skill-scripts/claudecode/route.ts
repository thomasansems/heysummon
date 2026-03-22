import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/v1/skill-scripts/claudecode
 *
 * Serves the ask.sh script for the Claude Code HeySummon skill.
 * Used by the setup flow to let users download the script directly.
 */
export async function GET() {
  const scriptPath = path.join(
    process.cwd(),
    "skills",
    "claudecode",
    "heysummon",
    "scripts",
    "ask.sh"
  );

  try {
    const content = fs.readFileSync(scriptPath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ask.sh"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Script not found" },
      { status: 404 }
    );
  }
}
