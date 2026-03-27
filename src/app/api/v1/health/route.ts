import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const connectivity = process.env.CONNECTIVITY_METHOD || "direct";
  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL || null;

  return NextResponse.json(
    {
      status: "ok",
      version: process.env.npm_package_version || "0.1.0",
      connectivity,
      ...(publicUrl && { publicUrl }),
      contentSafety: { enabled: true, mode: "in-process" },
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
