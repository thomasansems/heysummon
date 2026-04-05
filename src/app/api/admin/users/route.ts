import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["admin", "expert", "readonly"];

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      onboardingComplete: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const emailNorm = (email as string).toLowerCase().trim();
  if (!/^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/.test(emailNorm)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if ((password as string).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const assignedRole = VALID_ROLES.includes(role) ? role : "expert";

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password as string, 12);

  const user = await prisma.user.create({
    data: {
      email: emailNorm,
      password: hashedPassword,
      name: (name as string)?.trim() || null,
      role: assignedRole,
      emailVerified: new Date(),
      onboardingComplete: true,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  logAuditEvent({
    eventType: AuditEventTypes.ACCOUNT_CREATED,
    userId: me.id,
    success: true,
    metadata: { createdUserId: user.id, email: emailNorm, role: assignedRole, createdBy: me.id },
    request,
  });

  return NextResponse.json({ user });
}
