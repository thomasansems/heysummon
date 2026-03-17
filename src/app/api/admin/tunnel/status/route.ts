import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execSync } from "child_process";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL ?? null;
  const hostname = "https://thomas-pc.tail38a1e7.ts.net";

  try {
    const raw = execSync("tailscale funnel status --json 2>/dev/null", { timeout: 5000 }).toString();
    const data = JSON.parse(raw);
    const active = JSON.stringify(data).includes("3425");
    return NextResponse.json({ active, publicUrl, hostname });
  } catch {
    return NextResponse.json({ active: !!publicUrl, publicUrl, hostname });
  }
}
