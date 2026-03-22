import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { providerUpdateSchema, validateBody } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.userProfile.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isActive: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      availableDays: true,
      digestTime: true,
      tagline: true,
      taglineEnabled: true,
      userId: true,
    },
  });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const { userId: _uid, ...rest } = provider;
  return NextResponse.json({ provider: rest });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.userProfile.findUnique({ where: { id } });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(providerUpdateSchema, raw);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.timezone !== undefined) data.timezone = body.timezone;
  if (body.tagline !== undefined) data.tagline = (body.tagline as string).slice(0, 160) || null;
  if (body.taglineEnabled !== undefined) data.taglineEnabled = body.taglineEnabled;

  // Quiet hours & digest
  if (body.quietHoursStart !== undefined) data.quietHoursStart = body.quietHoursStart;
  if (body.quietHoursEnd !== undefined) data.quietHoursEnd = body.quietHoursEnd;
  if (body.availableDays !== undefined) data.availableDays = body.availableDays;
  if (body.digestTime !== undefined) data.digestTime = body.digestTime;

  // Phone-first
  if (body.phoneFirst !== undefined) data.phoneFirst = body.phoneFirst;
  if (body.phoneFirstIntegrationId !== undefined) data.phoneFirstIntegrationId = body.phoneFirstIntegrationId;
  if (body.phoneFirstTimeout !== undefined) data.phoneFirstTimeout = body.phoneFirstTimeout;

  const updated = await prisma.userProfile.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      isActive: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      availableDays: true,
      digestTime: true,
      tagline: true,
      taglineEnabled: true,
    },
  });

  return NextResponse.json({ provider: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.userProfile.findUnique({ where: { id } });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Unlink all API keys from this provider before deleting
  await prisma.apiKey.updateMany({
    where: { providerId: id },
    data: { providerId: null },
  });

  await prisma.userProfile.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
