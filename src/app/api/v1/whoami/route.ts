export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/whoami — Get info about a client API key
 * 
 * Returns the provider name and basic info linked to this key.
 * Header: x-api-key (client key, htl_...)
 */
export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "x-api-key header required" },
        { status: 401 }
      );
    }

    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: {
        provider: true,
        user: true,
      },
    });

    if (!key || !key.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      keyId: key.id,
      keyName: key.name,
      provider: key.provider
        ? {
            id: key.provider.id,
            name: key.provider.name,
            isActive: key.provider.isActive,
          }
        : null,
      expert: {
        id: key.user.id,
        name: key.user.name,
      },
    });
  } catch (err) {
    console.error("Whoami error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
