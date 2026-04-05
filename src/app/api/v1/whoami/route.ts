export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";

/**
 * GET /api/v1/whoami — Get info about a client API key
 *
 * Returns the expert name and basic info linked to this key.
 * Header: x-api-key (client key, htl_...)
 * Header: X-Device-Token (device secret, if key has device binding)
 */
export async function GET(request: Request) {
  try {
    const result = await validateApiKeyRequest(request, {
      include: { expert: true, user: true },
    });
    if (!result.ok) return result.response;
    const key = result.apiKey;

    return NextResponse.json({
      keyId: key.id,
      keyName: key.name,
      expert: key.expert
        ? {
            id: key.expert.id,
            name: key.expert.name,
            isActive: key.expert.isActive,
          }
        : null,
      owner: {
        id: key.user.id,
        name: key.user.name,
      },
    });
  } catch (err) {
    console.error("Whoami error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
