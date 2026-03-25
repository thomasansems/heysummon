import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const VALID_PLATFORMS = ["claudecode", "codex", "gemini", "cursor", "openclaw"] as const;

/**
 * GET /api/v1/skill-scripts/:platform?file=ask.sh
 *
 * Serves skill files for any supported HeySummon platform skill.
 * Supported files: ask.sh, sdk.sh, setup.sh, add-provider.sh,
 *                  list-providers.sh, check-status.sh, SKILL.md
 * Used by the setup flow to let users download skill files directly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }

  const platformSkillDir = path.join(process.cwd(), "skills", platform, "heysummon");
  const unifiedScriptsDir = path.join(process.cwd(), "skills", "heysummon", "scripts");
  const file = request.nextUrl.searchParams.get("file") || "ask.sh";

  // Whitelist allowed files to prevent directory traversal
  // Scripts come from the unified skills/heysummon/scripts/ directory
  // SKILL.md comes from the platform-specific directory
  const allowedFiles: Record<string, { path: string; contentType: string; filename: string }> = {
    "ask.sh": {
      path: path.join(unifiedScriptsDir, "ask.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "ask.sh",
    },
    "sdk.sh": {
      path: path.join(unifiedScriptsDir, "sdk.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "sdk.sh",
    },
    "setup.sh": {
      path: path.join(unifiedScriptsDir, "setup.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "setup.sh",
    },
    "add-provider.sh": {
      path: path.join(unifiedScriptsDir, "add-provider.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "add-provider.sh",
    },
    "list-providers.sh": {
      path: path.join(unifiedScriptsDir, "list-providers.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "list-providers.sh",
    },
    "check-status.sh": {
      path: path.join(unifiedScriptsDir, "check-status.sh"),
      contentType: "text/plain; charset=utf-8",
      filename: "check-status.sh",
    },
    "SKILL.md": {
      path: path.join(platformSkillDir, "SKILL.md"),
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
      { error: "Not found", detail: `${entry.path} (cwd: ${process.cwd()})` },
      { status: 404 }
    );
  }
}
