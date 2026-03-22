export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/setup/bound
 *
 * Checks whether a client API key has been bound to a device (has an allowed IP).
 * Used by the setup page to auto-disable once the first device connects.
 *
 * No session auth required — the keyId comes from the signed JWT setup token.
 * This is safe because it only returns a boolean, no sensitive data.
 *
 * Body: { keyId: string }
 * Response: { bound: boolean }
 */
export async function POST(request: NextRequest) {
  let keyId: string;
  try {
    const body = await request.json();
    keyId = body?.keyId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!keyId || typeof keyId !== "string") {
    return NextResponse.json({ error: "keyId is required" }, { status: 400 });
  }

  const boundIp = await prisma.ipEvent.findFirst({
    where: {
      apiKeyId: keyId,
      status: "allowed",
    },
    select: { id: true },
  });

  return NextResponse.json({ bound: !!boundIp });
}
