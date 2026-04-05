export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateExpertConfig } from "@/lib/adapters/twilio-voice";

/**
 * GET /api/integrations/expert-config?profileId=xxx
 * List expert integration configs for a given profile.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const configs = await prisma.expertIntegrationConfig.findMany({
    where: { profileId },
    include: { integration: { select: { id: true, type: true, name: true, category: true, isActive: true } } },
  });

  return NextResponse.json({ configs });
}

/**
 * POST /api/integrations/expert-config — Create or update an expert integration config.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { profileId, integrationId, config } = body;

  if (!profileId || !integrationId) {
    return NextResponse.json({ error: "profileId and integrationId are required" }, { status: 400 });
  }

  // Verify profile belongs to this user (or user is admin)
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get the integration to validate config
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });
  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  // Validate expert config based on integration type
  if (integration.type === "twilio") {
    const result = validateExpertConfig(config);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  // Upsert the expert config
  const expertConfig = await prisma.expertIntegrationConfig.upsert({
    where: {
      profileId_integrationId: {
        profileId,
        integrationId,
      },
    },
    create: {
      profileId,
      integrationId,
      config: JSON.stringify(config || {}),
    },
    update: {
      config: JSON.stringify(config || {}),
      isActive: true,
    },
    include: { integration: { select: { id: true, type: true, name: true, category: true } } },
  });

  return NextResponse.json({ config: expertConfig });
}
