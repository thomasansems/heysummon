import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const connectivity =
    process.env.CONNECTIVITY_METHOD || "direct";

  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version || "0.1.0",
    connectivity,
    timestamp: new Date().toISOString(),
  });
}
