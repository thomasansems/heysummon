import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { providerUpdateSchema, validateBody } from "@/lib/validations";
import { isCloud } from "@/lib/edition";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.provider.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isActive: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      digestTime: true,
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

  const provider = await prisma.provider.findUnique({ where: { id } });
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

  // Quiet hours & digest are cloud-only
  if (isCloud()) {
    if (body.quietHoursStart !== undefined) data.quietHoursStart = body.quietHoursStart;
    if (body.quietHoursEnd !== undefined) data.quietHoursEnd = body.quietHoursEnd;
    if (body.digestTime !== undefined) data.digestTime = body.digestTime;
  }

  const updated = await prisma.provider.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      isActive: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      digestTime: true,
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

  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Unlink all API keys from this provider before deleting
  await prisma.apiKey.updateMany({
    where: { providerId: id },
    data: { providerId: null },
  });

  await prisma.provider.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
