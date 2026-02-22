export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCloud } from "@/lib/edition";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCloud()) {
    return NextResponse.json({ error: "mTLS certificates are a cloud-only feature" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const cert = await prisma.clientCertificate.findFirst({ where: { id, userId: user.id } });
  if (!cert) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }
  if (cert.revoked) {
    return NextResponse.json({ error: "Certificate is already revoked" }, { status: 400 });
  }
  const updated = await prisma.clientCertificate.update({
    where: { id },
    data: { revoked: true, revokedAt: new Date() },
  });
  return NextResponse.json({ id: updated.id, revoked: updated.revoked, revokedAt: updated.revokedAt });
}
