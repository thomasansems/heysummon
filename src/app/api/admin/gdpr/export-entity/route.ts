import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGdprSettings, anonymizeIp } from "@/lib/gdpr";

/**
 * POST /api/admin/gdpr/export-entity — export data for a specific client or expert
 *
 * Body: { type: "client" | "expert", id: string }
 *
 * Admin only. Exports all data associated with a specific API key (client) or
 * expert profile, scoped to that entity rather than the entire user account.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fullUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, id } = body;

  if (!type || !id) {
    return NextResponse.json({ error: "type and id are required" }, { status: 400 });
  }

  const settings = await getGdprSettings();
  if (settings.enabled && !settings.allowDataExport) {
    return NextResponse.json({ error: "Data export is disabled" }, { status: 403 });
  }

  const processIp = (ip: string | null) => {
    if (!ip) return ip;
    return settings.enabled && settings.anonymizeIps ? anonymizeIp(ip) : ip;
  };

  if (type === "client") {
    return exportClientData(id, processIp);
  }

  if (type === "expert") {
    return exportExpertData(id, processIp);
  }

  return NextResponse.json({ error: "type must be \"client\" or \"expert\"" }, { status: 400 });
}

async function exportClientData(
  apiKeyId: string,
  processIp: (ip: string | null) => string | null,
) {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    include: {
      ipEvents: true,
    },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const requests = await prisma.helpRequest.findMany({
    where: { apiKeyId },
    include: { messageHistory: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    exportDate: new Date().toISOString(),
    gdprArticle: "Art. 15 GDPR — Right of Access",
    entityType: "client",
    client: {
      id: apiKey.id,
      name: apiKey.name,
      scope: apiKey.scope,
      isActive: apiKey.isActive,
      clientChannel: apiKey.clientChannel,
      clientSubChannel: apiKey.clientSubChannel,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      createdAt: apiKey.createdAt,
      lastPollAt: apiKey.lastPollAt,
      ipEvents: apiKey.ipEvents.map((e) => ({
        id: e.id,
        ip: processIp(e.ip),
        status: e.status,
        attempts: e.attempts,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
      })),
    },
    requests: requests.map((r) => ({
      id: r.id,
      refCode: r.refCode,
      status: r.status,
      questionPreview: r.questionPreview,
      response: r.response,
      requiresApproval: r.requiresApproval,
      approvalDecision: r.approvalDecision,
      rating: r.rating,
      ratingFeedback: r.ratingFeedback,
      consumerName: r.consumerName,
      guardVerified: r.guardVerified,
      phoneCallStatus: r.phoneCallStatus,
      phoneCallResponse: r.phoneCallResponse,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      closedAt: r.closedAt,
      expiresAt: r.expiresAt,
      messageHistory: r.messageHistory.map((m) => ({
        id: m.id,
        from: m.from,
        messageId: m.messageId,
        createdAt: m.createdAt,
      })),
    })),
    summary: {
      totalRequests: requests.length,
      totalMessages: requests.reduce((sum, r) => sum + r.messageHistory.length, 0),
    },
  });
}

async function exportExpertData(
  profileId: string,
  processIp: (ip: string | null) => string | null,
) {
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      expertChannels: true,
      ipEvents: true,
      integrationConfigs: {
        include: { integration: { select: { id: true, type: true, name: true, category: true } } },
      },
      apiKeys: {
        select: { id: true, name: true, clientChannel: true, clientSubChannel: true, isActive: true, createdAt: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  // Get all requests handled by this expert (via API keys linked to this profile)
  const apiKeyIds = profile.apiKeys.map((k) => k.id);
  const requests = await prisma.helpRequest.findMany({
    where: { apiKeyId: { in: apiKeyIds } },
    include: { messageHistory: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    exportDate: new Date().toISOString(),
    gdprArticle: "Art. 15 GDPR — Right of Access",
    entityType: "expert",
    expert: {
      id: profile.id,
      name: profile.name,
      isActive: profile.isActive,
      timezone: profile.timezone,
      phoneFirst: profile.phoneFirst,
      phoneFirstTimeout: profile.phoneFirstTimeout,
      createdAt: profile.createdAt,
      expertChannels: profile.expertChannels.map((cp) => ({
        id: cp.id,
        type: cp.type,
        name: cp.name,
        isActive: cp.isActive,
        status: cp.status,
        paired: cp.paired,
        createdAt: cp.createdAt,
      })),
      ipEvents: profile.ipEvents.map((e) => ({
        id: e.id,
        ip: processIp(e.ip),
        status: e.status,
        attempts: e.attempts,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
      })),
      integrations: profile.integrationConfigs.map((ic) => ({
        integrationId: ic.integrationId,
        type: ic.integration.type,
        name: ic.integration.name,
        isActive: ic.isActive,
      })),
    },
    linkedClients: profile.apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      clientChannel: k.clientChannel,
      clientSubChannel: k.clientSubChannel,
      isActive: k.isActive,
      createdAt: k.createdAt,
    })),
    requests: requests.map((r) => ({
      id: r.id,
      refCode: r.refCode,
      status: r.status,
      questionPreview: r.questionPreview,
      response: r.response,
      requiresApproval: r.requiresApproval,
      approvalDecision: r.approvalDecision,
      rating: r.rating,
      ratingFeedback: r.ratingFeedback,
      consumerName: r.consumerName,
      guardVerified: r.guardVerified,
      phoneCallStatus: r.phoneCallStatus,
      phoneCallResponse: r.phoneCallResponse,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      closedAt: r.closedAt,
      expiresAt: r.expiresAt,
      messageHistory: r.messageHistory.map((m) => ({
        id: m.id,
        from: m.from,
        messageId: m.messageId,
        createdAt: m.createdAt,
      })),
    })),
    summary: {
      totalClients: profile.apiKeys.length,
      totalRequests: requests.length,
      totalMessages: requests.reduce((sum, r) => sum + r.messageHistory.length, 0),
    },
  });
}
