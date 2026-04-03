export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";

/**
 * GET /api/v1/experts — Returns the expert linked to this client API key.
 *
 * Used by consumer clients to list available human experts.
 * Auth: x-api-key (client key)
 */
export async function GET(request: Request) {
  try {
    const result = await validateApiKeyRequest(request, {
      include: { expert: true },
    });
    if (!result.ok) return result.response;
    const key = result.apiKey;

    if (!key.expert) {
      return NextResponse.json({ experts: [] });
    }

    return NextResponse.json({
      experts: [
        {
          id: key.expert.id,
          name: key.expert.name,
          isActive: key.expert.isActive,
        },
      ],
    });
  } catch (err) {
    console.error("Experts error:", sanitizeError(err));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
