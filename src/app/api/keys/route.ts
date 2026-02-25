import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keyCreateSchema, validateBody } from "@/lib/validations";
import { logAuditEvent, AuditEventTypes, redactApiKey } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      scope: true,
      rateLimitPerMinute: true,
      previousKeyExpiresAt: true,
      createdAt: true,
      machineId: true,
      provider: { select: { id: true, name: true } },
      ipEvents: {
        select: {
          id: true,
          ip: true,
          status: true,
          attempts: true,
          firstSeen: true,
          lastSeen: true,
        },
        orderBy: { firstSeen: "asc" },
      },
      _count: { select: { requests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = validateBody(keyCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { name, providerId, scope, rateLimitPerMinute } = parsed.data;

  if (providerId) {
    const provider = await prisma.userProfile.findFirst({
      where: { id: providerId, userId: user.id },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 400 });
    }
  }

  const key = await prisma.apiKey.create({
    data: {
      key: generateApiKey(),
      name: name || null,
      user: { connect: { id: user.id } },
      ...(scope && { scope }),
      ...(rateLimitPerMinute && { rateLimitPerMinute }),
      ...(providerId && { provider: { connect: { id: providerId } } }),
    },
  });

  logAuditEvent({
    eventType: AuditEventTypes.API_KEY_CREATED,
    userId: user.id,
    apiKeyId: key.id,
    success: true,
    metadata: { name: name || null, providerId: providerId || null, keyHint: redactApiKey(key.key) },
    request,
  });

  return NextResponse.json({ key });
}
