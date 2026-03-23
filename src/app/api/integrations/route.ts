export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  validateSystemConfig,
  verifyTwilioCredentials,
} from "@/lib/adapters/twilio-voice";

/**
 * GET /api/integrations — List all integrations.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integrations = await prisma.integration.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { providerConfigs: true } },
    },
  });

  return NextResponse.json({ integrations });
}

/**
 * POST /api/integrations — Create a new integration (admin only).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { type, name, config } = body;

  if (!type || !name) {
    return NextResponse.json({ error: "type and name are required" }, { status: 400 });
  }

  // Check for duplicate type
  const existing = await prisma.integration.findUnique({ where: { type } });
  if (existing) {
    return NextResponse.json({ error: `Integration of type "${type}" already exists` }, { status: 409 });
  }

  // Determine category from type
  const categoryMap: Record<string, string> = {
    twilio: "voice",
  };
  const category = categoryMap[type] || "other";

  // Validate config based on type
  if (type === "twilio") {
    const result = validateSystemConfig(config);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Verify credentials are actually valid
    const verify = await verifyTwilioCredentials(result.config.accountSid, result.config.authToken);
    if (!verify.valid) {
      return NextResponse.json({ error: verify.error }, { status: 400 });
    }
  }

  const integration = await prisma.integration.create({
    data: {
      type,
      category,
      name,
      config: JSON.stringify(config || {}),
    },
  });

  return NextResponse.json({ integration }, { status: 201 });
}
