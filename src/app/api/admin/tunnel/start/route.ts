import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { setWebhook } from "@/lib/adapters/telegram";
import type { TelegramConfig } from "@/lib/adapters/types";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function updateEnvVar(key: string, value: string) {
  let content = "";
  try { content = fs.readFileSync(ENV_PATH, "utf8"); } catch { /* new file */ }
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, "utf8");
}

function getTailscaleHostname(): string | null {
  try {
    const raw = execSync("tailscale status --json 2>/dev/null", { timeout: 5000 }).toString();
    const data = JSON.parse(raw);
    const dnsName = data?.Self?.DNSName as string | undefined;
    if (dnsName) return `https://${dnsName.replace(/\.$/, "")}`;
  } catch { /* ignore */ }
  return null;
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fullUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Expose port 3425 via Tailscale Funnel (full port, HTTPS)
    // NOTE: NEVER use localtunnel — Tailscale Funnel only
    // The app is protected by NextAuth session + API key checks on all sensitive endpoints
    execSync("tailscale funnel --bg 3425", { timeout: 10000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("already") && !msg.toLowerCase().includes("success")) {
      console.error("[tunnel/start] Failed to start funnel:", err);
      return NextResponse.json({ error: "Failed to start funnel" }, { status: 500 });
    }
  }

  // Get the actual Tailscale hostname dynamically
  const publicUrl = getTailscaleHostname() ?? process.env.HEYSUMMON_PUBLIC_URL ?? "";
  if (!publicUrl) {
    return NextResponse.json({ error: "Tailscale funnel started but could not determine public URL." }, { status: 500 });
  }

  // Persist to .env.local
  updateEnvVar("HEYSUMMON_PUBLIC_URL", publicUrl);
  updateEnvVar("NEXTAUTH_URL", publicUrl);
  process.env.HEYSUMMON_PUBLIC_URL = publicUrl;
  process.env.NEXTAUTH_URL = publicUrl;

  // Re-register all active Telegram channel webhooks
  const channels = await prisma.expertChannel.findMany({
    where: { type: "telegram", isActive: true },
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const ch of channels) {
    try {
      const cfg = JSON.parse(ch.config) as TelegramConfig;
      if (!cfg.botToken) continue;
      // Generate a secret if activation previously failed (channel created while tunnel was down)
      const webhookSecret = cfg.webhookSecret ?? crypto.randomBytes(32).toString("hex");
      const webhookUrl = `${publicUrl}/api/adapters/telegram/${ch.id}/webhook`;
      await setWebhook(cfg.botToken, webhookUrl, webhookSecret);
      await prisma.expertChannel.update({
        where: { id: ch.id },
        data: {
          config: JSON.stringify({ ...cfg, webhookSecret }),
          status: "connected",
          errorMessage: null,
        },
      });
      results.push({ id: ch.id, ok: true });
    } catch (err) {
      console.error(`[tunnel/start] Webhook update failed for channel ${ch.id}:`, err);
      results.push({ id: ch.id, ok: false, error: "Webhook update failed" });
    }
  }

  return NextResponse.json({ ok: true, publicUrl, webhooksUpdated: results });
}
