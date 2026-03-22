import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execSync } from "child_process";

function getTailscaleHostname(): string | null {
  try {
    const raw = execSync("tailscale status --json 2>/dev/null", { timeout: 5000 }).toString();
    const data = JSON.parse(raw);
    const dnsName = data?.Self?.DNSName as string | undefined;
    if (dnsName) return `https://${dnsName.replace(/\.$/, "")}`;
  } catch { /* ignore */ }
  return null;
}

function detectMethod(url: string): "tailscale" | "cloudflared" | "custom" {
  if (url.includes(".ts.net")) return "tailscale";
  if (url.includes("trycloudflare.com") || url.includes(".cloudflare")) return "cloudflared";
  return "custom";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Detect tool availability
  let tailscaleAvailable = false;
  let cloudflaredAvailable = false;
  let needsOperatorSetup = false;
  let tailscaleActive = false;
  let tailscaleHostname: string | null = null;

  try {
    execSync("which tailscale 2>/dev/null", { timeout: 2000 });
    tailscaleAvailable = true;
  } catch { /* not installed */ }

  try {
    execSync("which cloudflared 2>/dev/null", { timeout: 2000 });
    cloudflaredAvailable = true;
  } catch { /* not installed */ }

  // Check Tailscale Funnel status
  if (tailscaleAvailable) {
    try {
      const raw = execSync("tailscale funnel status 2>&1", { timeout: 5000 }).toString();
      needsOperatorSetup = raw.includes("permission denied") || raw.includes("operator") || raw.includes("not allowed");
      tailscaleActive = raw.includes("3425") && raw.includes("Funnel on");
      if (tailscaleActive) {
        tailscaleHostname = getTailscaleHostname();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      needsOperatorSetup = msg.includes("permission denied") || msg.includes("operator");
    }
  }

  // HEYSUMMON_PUBLIC_URL takes priority — it's explicitly configured
  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL ?? null;
  if (publicUrl && !publicUrl.includes("localhost") && !publicUrl.includes("127.0.0.1")) {
    const method = detectMethod(publicUrl);
    return NextResponse.json({
      accessible: true,
      active: true, // backward compat
      method,
      publicUrl,
      hostname: publicUrl,
      tailscaleAvailable,
      cloudflaredAvailable,
      needsOperatorSetup,
    });
  }

  // Tailscale Funnel is active but URL wasn't saved to env yet
  if (tailscaleActive && tailscaleHostname) {
    return NextResponse.json({
      accessible: true,
      active: true,
      method: "tailscale",
      publicUrl: tailscaleHostname,
      hostname: tailscaleHostname,
      tailscaleAvailable,
      cloudflaredAvailable,
      needsOperatorSetup,
    });
  }

  return NextResponse.json({
    accessible: false,
    active: false,
    method: "none",
    publicUrl: null,
    hostname: null,
    tailscaleAvailable,
    cloudflaredAvailable,
    needsOperatorSetup,
  });
}
