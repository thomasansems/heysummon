import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/audit-logs — List audit log entries
 *
 * Auth required: admin role sees all, regular users see only their own events.
 * Query params: eventType, userId, startDate, endDate, cursor, limit
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const eventType = params.get("eventType") || undefined;
  const userId = params.get("userId") || undefined;
  const startDate = params.get("startDate") || undefined;
  const endDate = params.get("endDate") || undefined;
  const cursor = params.get("cursor") || undefined;
  const limit = Math.min(Number(params.get("limit")) || 50, 100);

  // Non-admin users can only see their own audit events
  const isAdmin = user.role === "admin";
  const filterUserId = isAdmin ? userId : user.id;

  const where: Record<string, unknown> = {};
  if (eventType) where.eventType = eventType;
  if (filterUserId) where.userId = filterUserId;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Redact sensitive metadata fields in response
  const redactedItems = items.map((log) => {
    let metadata = null;
    if (log.metadata) {
      try {
        metadata = JSON.parse(log.metadata);
      } catch {
        metadata = null;
      }
    }
    return {
      id: log.id,
      eventType: log.eventType,
      userId: log.userId,
      apiKeyId: log.apiKeyId,
      ip: log.ip,
      userAgent: log.userAgent,
      metadata,
      success: log.success,
      createdAt: log.createdAt,
    };
  });

  return NextResponse.json({
    items: redactedItems,
    nextCursor,
    hasMore,
  });
}
