import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SKILL_DIR = path.join(process.cwd(), "skills", "claudecode", "heysummon");

/**
 * GET /api/v1/skill-scripts/claudecode?file=ask.sh
 *
 * Serves skill files for the Claude Code HeySummon skill.
 * Supported files: ask.sh, SKILL.md
 * Used by the setup flow to let users download skill files directly.
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file") || "ask.sh";

  // Whitelist allowed files to prevent directory traversal
  const allowedFiles: Record<string, { path: string; contentType: string; filename: string }> = {
    "ask.sh": {
      path: path.join(SKILL_DIR, "scripts", "ask.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "ask.sh",
    },
    "SKILL.md": {
      path: path.join(SKILL_DIR, "SKILL.md"),
      contentType: "text/markdown; charset=utf-8",
      filename: "SKILL.md",
    },
  };

  const entry = allowedFiles[file];
  if (!entry) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(entry.path, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": entry.contentType,
        "Content-Disposition": `attachment; filename="${entry.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found on server" },
      { status: 404 }
    );
  }
}
