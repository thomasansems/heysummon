import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/v1/mcp-install/:keyId
 *
 * Returns a Claude Code MCP setup snippet pre-configured with
 * HEYSUMMON_BASE_URL and HEYSUMMON_API_KEY for one-click Claude Code setup.
 *
 * Auth: dashboard user (must own the key)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      provider: { userId: user.id },
    },
    select: { id: true, key: true, name: true },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3425";
  const baseUrl = `${proto}://${host}`;

  const snippet = buildMcpSnippet(baseUrl, apiKey.key);

  return NextResponse.json({ snippet, baseUrl, key: apiKey.key });
}

function buildMcpSnippet(baseUrl: string, apiKey: string): string {
  return `# HeySummon MCP — Claude Code setup
# Run this command to register the HeySummon MCP server:

claude mcp add heysummon \\
  --env HEYSUMMON_BASE_URL="${baseUrl}" \\
  --env HEYSUMMON_API_KEY="${apiKey}" \\
  -- npx @heysummon/mcp

# Or add manually to ~/.claude/settings.json:
# {
#   "mcpServers": {
#     "heysummon": {
#       "command": "npx",
#       "args": ["@heysummon/mcp"],
#       "env": {
#         "HEYSUMMON_BASE_URL": "${baseUrl}",
#         "HEYSUMMON_API_KEY": "${apiKey}"
#       }
#     }
#   }
# }`;
}
