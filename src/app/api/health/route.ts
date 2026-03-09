import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health — Application health check
 *
 * Verifies database connectivity and returns basic status.
 * Use this after pm2 restart to confirm the server is ready before
 * expecting dashboard data to be available.
 *
 * Note: Rate limiting is intentionally in-memory and resets on restart.
 * All application data (users, keys, requests, channels) persists in the
 * SQLite database (prisma/heysummon.db) and is NOT affected by restarts.
 */
export async function GET() {
  try {
    // Verify database is accessible
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
      notes: {
        rateLimiting: "in-memory (resets on restart — by design)",
        sessions: "JWT-based (persists in client cookie — unaffected by restart)",
        data: "SQLite (persists on disk — unaffected by restart)",
      },
    });
  } catch (err) {
    console.error("[Health] Database check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
