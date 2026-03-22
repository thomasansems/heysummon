export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";

/**
 * GET /api/v1/providers — Returns the provider linked to this client API key.
 *
 * Used by the `heysummon_providers` MCP tool to list available human experts.
 * Auth: x-api-key (client key)
 */
export async function GET(request: Request) {
  try {
    const result = await validateApiKeyRequest(request, {
      include: { provider: true },
    });
    if (!result.ok) return result.response;
    const key = result.apiKey;

    if (!key.provider) {
      return NextResponse.json({ providers: [] });
    }

    return NextResponse.json({
      providers: [
        {
          id: key.provider.id,
          name: key.provider.name,
          isActive: key.provider.isActive,
        },
      ],
    });
  } catch (err) {
    console.error("Providers error:", sanitizeError(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
