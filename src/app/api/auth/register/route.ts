import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/register — Create a new account with email + password
 *
 * Only available when ENABLE_FORM_LOGIN is active.
 * First user gets auto-verified. Subsequent users also auto-verified (no email confirmation needed).
 */
export async function POST(request: NextRequest) {
  if (process.env.ENABLE_FORM_LOGIN === "false") {
    return NextResponse.json({ error: "Form login is disabled" }, { status: 403 });
  }

  try {
    // Single-admin: only the first user can register unless ALLOW_REGISTRATION=true
    if (process.env.ALLOW_REGISTRATION !== "true") {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return NextResponse.json(
          { error: "Registration is closed. Contact the administrator." },
          { status: 403 }
        );
      }
    }
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const emailNorm = email.toLowerCase().trim();

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      // Don't reveal whether the email exists (security)
      return NextResponse.json({ error: "Unable to create account. Try logging in instead." }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // First user becomes admin, subsequent users are regular experts
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashedPassword,
        name: name?.trim() || null,
        role: isFirstUser ? "admin" : "expert",
        emailVerified: new Date(), // Auto-verified for self-hosted simplicity
        onboardingComplete: isFirstUser, // Skip onboarding for admin
      },
    });

    logAuditEvent({
      eventType: AuditEventTypes.ACCOUNT_CREATED,
      userId: user.id,
      success: true,
      metadata: { email: emailNorm },
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Account created. You can now sign in.",
      userId: user.id,
    });
  } catch (err) {
    console.error("[Register] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
