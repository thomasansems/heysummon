import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function checkGuardHealth(): Promise<{
  reachable: boolean;
  latencyMs?: number;
}> {
  // When running inside Docker, Guard is on the frontend network.
  // Platform is on the backend network only, so we check Guard
  // via its internal Docker hostname if available, otherwise skip.
  const guardUrl =
    process.env.GUARD_INTERNAL_URL || "http://heysummon-guard:3000";
  const start = Date.now();
  try {
    const res = await fetch(`${guardUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;
    return { reachable: res.ok, latencyMs };
  } catch {
    return { reachable: false };
  }
}

export async function GET() {
  const connectivity = process.env.CONNECTIVITY_METHOD || "direct";
  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL || null;
  const guardEnabled = process.env.REQUIRE_GUARD !== "false";

  let guard: { reachable: boolean; latencyMs?: number } | undefined;
  if (guardEnabled) {
    guard = await checkGuardHealth();
  }

  const allHealthy = !guardEnabled || (guard?.reachable ?? false);

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      version: process.env.npm_package_version || "0.1.0",
      connectivity,
      ...(publicUrl && { publicUrl }),
      guard: guardEnabled
        ? {
            enabled: true,
            reachable: guard?.reachable ?? false,
            ...(guard?.latencyMs !== undefined && {
              latencyMs: guard.latencyMs,
            }),
          }
        : { enabled: false },
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 200 }
  );
}
