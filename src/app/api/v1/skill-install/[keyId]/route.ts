import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;

  // Look up the key by ID (public endpoint — URL is the secret)
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: {
      id: true,
      key: true,
      isActive: true,
      scope: true,
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only client keys (hs_live_ or hs_cli_) should be used for skill installs
  if (apiKey.scope === "provider") {
    return NextResponse.json({ error: "Invalid key type" }, { status: 400 });
  }

  // Read the SKILL.md template from the skills directory
  const skillPath = join(process.cwd(), "skills", "openclaw", "heysummon", "SKILL.md");
  let skillContent: string;
  try {
    skillContent = readFileSync(skillPath, "utf-8");
  } catch {
    return NextResponse.json({ error: "Skill template not found" }, { status: 500 });
  }

  // Detect the base URL from the incoming request
  const requestUrl = new URL(request.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

  // Inject pre-filled config into the SKILL.md
  const injectedConfig = `\`\`\`env
HEYSUMMON_BASE_URL=${baseUrl}
HEYSUMMON_API_KEY=${apiKey.key}
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=your_chat_id
\`\`\``;

  // Replace the placeholder config block in SKILL.md
  const configRegex = new RegExp(
    "```env\\nHEYSUMMON_BASE_URL=.*?\\nHEYSUMMON_API_KEY=.*?\\nHEYSUMMON_NOTIFY_MODE=.*?\\nHEYSUMMON_NOTIFY_TARGET=.*?\\n```",
    "s"
  );
  const patched = skillContent.replace(configRegex, injectedConfig);

  // Return as plain text so OpenClaw / ClawHub can load it directly
  return new NextResponse(patched, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
