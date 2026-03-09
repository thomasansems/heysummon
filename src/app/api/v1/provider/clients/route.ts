import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { generateApiKey } from "@/lib/auth";

/**
 * GET /api/v1/provider/clients — list all client keys for this provider
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const clients = await prisma.apiKey.findMany({
    where: { providerId: auth.apiKey.providerId },
    select: {
      id: true,
      name: true,
      key: true,
      isActive: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ clients });
}

/**
 * POST /api/v1/provider/clients — create a new client key
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const name = body.name?.trim() || `Client ${new Date().toISOString().slice(0, 10)}`;

  // Get the userId for the provider
  const provider = await prisma.userProfile.findUnique({
    where: { id: auth.apiKey.providerId! },
    select: { userId: true },
  });

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const client = await prisma.apiKey.create({
    data: {
      name,
      key: generateApiKey("hs_cli_"),
      userId: provider.userId,
      providerId: auth.apiKey.providerId!,
      scope: body.scope || "full",
      rateLimitPerMinute: body.rateLimitPerMinute || 100,
    },
    select: { id: true, name: true, key: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ client });
}
