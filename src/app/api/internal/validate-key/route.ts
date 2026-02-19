export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/internal/validate-key
 * Used by the relay service to validate API keys against the platform DB.
 * Protected by a shared RELAY_SECRET header.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-relay-secret");
  if (!process.env.RELAY_SECRET || secret !== process.env.RELAY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await request.json().catch(() => ({ key: null }));
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    select: { id: true, isActive: true, userId: true },
  });

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  return NextResponse.json({ valid: true, ownerId: apiKey.userId });
}
