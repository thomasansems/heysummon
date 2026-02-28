import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface MercureHealthResponse {
  status: "healthy" | "unhealthy";
  mercureUrl: string;
  lastCheck: string;
  responseTime?: number;
  error?: string;
}

export async function GET() {
  const mercureUrl = process.env.MERCURE_HUB_URL || "http://localhost:3426/.well-known/mercure";
  const mercureBaseUrl = mercureUrl.replace("/.well-known/mercure", "");
  const healthEndpoint = `${mercureBaseUrl}/healthz`;

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(healthEndpoint, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return NextResponse.json<MercureHealthResponse>({
        status: "healthy",
        mercureUrl: mercureBaseUrl,
        lastCheck: new Date().toISOString(),
        responseTime,
      });
    }

    return NextResponse.json<MercureHealthResponse>({
      status: "unhealthy",
      mercureUrl: mercureBaseUrl,
      lastCheck: new Date().toISOString(),
      responseTime,
      error: `HTTP ${response.status}`,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return NextResponse.json<MercureHealthResponse>({
      status: "unhealthy",
      mercureUrl: mercureBaseUrl,
      lastCheck: new Date().toISOString(),
      responseTime,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
