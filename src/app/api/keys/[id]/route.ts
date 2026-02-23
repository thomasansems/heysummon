import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keyUpdateSchema, validateBody } from "@/lib/validations";
import { logAuditEvent, AuditEventType, redactApiKey } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== user.id) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(keyUpdateSchema, raw);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.apiKey.update({
    where: { id },
    data,
    select: { id: true, name: true, isActive: true },
  });

  logAuditEvent({
    eventType: AuditEventType.API_KEY_ROTATED,
    userId: user.id,
    apiKeyId: id,
    success: true,
    metadata: { changes: body, keyHint: redactApiKey(key.key) },
    request,
  });

  return NextResponse.json({ key: updated });
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

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== user.id) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  // Cascade delete: remove all linked messages and requests first
  const requests = await prisma.helpRequest.findMany({
    where: { apiKeyId: id },
    select: { id: true },
  });

  if (requests.length > 0) {
    const requestIds = requests.map((r) => r.id);
    // Delete messages linked to these requests
    await prisma.message.deleteMany({ where: { requestId: { in: requestIds } } });
    // Delete the requests
    await prisma.helpRequest.deleteMany({ where: { apiKeyId: id } });
  }

  await prisma.apiKey.delete({ where: { id } });

  logAuditEvent({
    eventType: AuditEventType.API_KEY_DELETED,
    userId: user.id,
    apiKeyId: id,
    success: true,
    metadata: { keyHint: redactApiKey(key.key), deletedRequests: requests.length },
    request: _request,
  });

  return NextResponse.json({ success: true, deletedRequests: requests.length });
}
