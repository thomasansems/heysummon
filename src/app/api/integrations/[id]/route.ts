export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  validateSystemConfig,
  verifyTwilioCredentials,
} from "@/lib/adapters/twilio-voice";

/**
 * GET /api/integrations/:id — Get a single integration.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const integration = await prisma.integration.findUnique({
    where: { id },
    include: {
      providerConfigs: {
        include: { profile: { select: { id: true, name: true } } },
      },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json({ integration });
}

/**
 * PATCH /api/integrations/:id — Update an integration (admin only).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, config, isActive } = body;

  const existing = await prisma.integration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  // Validate config if provided
  if (config && existing.type === "twilio") {
    const result = validateSystemConfig(config);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const verify = await verifyTwilioCredentials(result.config.accountSid, result.config.authToken);
    if (!verify.valid) {
      return NextResponse.json({ error: verify.error }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (config !== undefined) data.config = JSON.stringify(config);
  if (isActive !== undefined) data.isActive = isActive;

  const integration = await prisma.integration.update({
    where: { id },
    data,
  });

  return NextResponse.json({ integration });
}

/**
 * DELETE /api/integrations/:id — Delete an integration (admin only).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.integration.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
