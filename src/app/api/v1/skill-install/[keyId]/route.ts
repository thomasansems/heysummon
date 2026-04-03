import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";
import fs from "fs";
import path from "path";

/**
 * GET /api/v1/skill-install/:keyId
 *
 * Returns a pre-configured SKILL.md for the OpenClaw HeySummon consumer skill.
 * The skill content has HEYSUMMON_BASE_URL and HEYSUMMON_API_KEY injected,
 * so the client can paste the URL into OpenClaw for one-click setup.
 *
 * Auth: dashboard user (must own the key)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;

  // Require authenticated dashboard user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Find the key — must belong to an expert owned by this user
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      expert: { userId: user.id },
    },
    select: { id: true, key: true, name: true },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const baseUrl = getPublicBaseUrl(request);

  // Load skill template
  const skillPath = path.join(process.cwd(), "skills", "openclaw", "heysummon", "SKILL.md");
  let skillContent: string;

  try {
    skillContent = fs.readFileSync(skillPath, "utf-8");
  } catch {
    return NextResponse.json({ error: "Skill template not found" }, { status: 500 });
  }

  // Inject configuration values
  const configured = injectConfig(skillContent, baseUrl, apiKey.key);

  return new NextResponse(configured, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="SKILL.md"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Inject HEYSUMMON_BASE_URL and HEYSUMMON_API_KEY into the skill template.
 * Replaces placeholder values in the .env example block.
 */
function injectConfig(content: string, baseUrl: string, apiKey: string): string {
  return content
    .replace(
      /HEYSUMMON_BASE_URL=.*/g,
      `HEYSUMMON_BASE_URL=${baseUrl}`
    )
    .replace(
      /HEYSUMMON_API_KEY=.*/g,
      `HEYSUMMON_API_KEY=${apiKey}`
    );
}
