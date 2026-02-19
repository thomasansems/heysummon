import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    include: { _count: { select: { requests: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await request.json().catch(() => ({ name: null }));

  const key = await prisma.apiKey.create({
    data: {
      key: generateApiKey(),
      name: name || null,
      userId: user.id,
    },
  });

  return NextResponse.json({ key });
}

/**
 * PATCH /api/keys
 * Self-service endpoint for agents: authenticate with x-api-key header
 * to update settings on the key itself (e.g. providerWebhookUrl).
 * No session required — designed for programmatic use between Chat providers.
 */
export async function PATCH(request: Request) {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return NextResponse.json(
      { error: "x-api-key header is required" },
      { status: 401 }
    );
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { key: rawKey },
    select: { id: true, isActive: true },
  });

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json(
      { error: "Invalid or inactive API key" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { providerWebhookUrl } = body as { providerWebhookUrl?: string };

  // Validate URL if provided
  if (providerWebhookUrl) {
    try {
      const url = new URL(providerWebhookUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return NextResponse.json(
        { error: "providerWebhookUrl must be a valid HTTP(S) URL" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { providerWebhookUrl: providerWebhookUrl ?? null },
    select: { id: true, name: true, providerWebhookUrl: true },
  });

  return NextResponse.json({ key: updated });
}
