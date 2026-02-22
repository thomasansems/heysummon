export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCloud } from "@/lib/edition";
import { generateClientCertificate } from "@/lib/mtls.cloud";
import { certificateCreateSchema, validateBody } from "@/lib/validations";

export async function POST(request: Request) {
  if (!isCloud()) {
    return NextResponse.json({ error: "mTLS certificates are a cloud-only feature" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const raw = await request.json();
  const parsed = validateBody(certificateCreateSchema, raw);
  if (!parsed.success) return parsed.response;
  const { name, validityDays } = parsed.data;
  const generated = generateClientCertificate(`${name} - ${user.email}`, validityDays);
  const record = await prisma.clientCertificate.create({
    data: {
      userId: user.id, name,
      fingerprint: generated.fingerprint, serialNumber: generated.serialNumber,
      notBefore: generated.notBefore, notAfter: generated.notAfter,
    },
  });
  return NextResponse.json({
    id: record.id, name: record.name, fingerprint: record.fingerprint,
    serialNumber: record.serialNumber, notBefore: record.notBefore, notAfter: record.notAfter,
    certificate: generated.certificate, privateKey: generated.privateKey,
  }, { status: 201 });
}

export async function GET() {
  if (!isCloud()) {
    return NextResponse.json({ error: "mTLS certificates are a cloud-only feature" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const certificates = await prisma.clientCertificate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, fingerprint: true, serialNumber: true,
      notBefore: true, notAfter: true, revoked: true, revokedAt: true, createdAt: true,
    },
  });
  return NextResponse.json({ certificates });
}
