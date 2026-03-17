import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { setWebhook } from "@/lib/adapters/telegram";
import type { TelegramConfig } from "@/lib/adapters/types";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const PUBLIC_URL = "https://thomas-pc.tail38a1e7.ts.net";

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

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Start Tailscale Funnel for port 3425
    // NOTE: NEVER use localtunnel — Tailscale Funnel only
    execSync("tailscale funnel --bg 3425", { timeout: 10000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("already") && !msg.toLowerCase().includes("success")) {
      return NextResponse.json({ error: `Failed to start funnel: ${msg}` }, { status: 500 });
    }
  }

  // Persist to .env.local
  updateEnvVar("HEYSUMMON_PUBLIC_URL", PUBLIC_URL);
  process.env.HEYSUMMON_PUBLIC_URL = PUBLIC_URL;

  // Re-register all active Telegram channel webhooks
  const channels = await prisma.channelProvider.findMany({
    where: { type: "telegram", isActive: true },
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const ch of channels) {
    try {
      const cfg = JSON.parse(ch.config) as TelegramConfig;
      if (!cfg.botToken || !cfg.webhookSecret) continue;
      const webhookUrl = `${PUBLIC_URL}/api/adapters/telegram/${ch.id}/webhook`;
      await setWebhook(cfg.botToken, webhookUrl, cfg.webhookSecret);
      await prisma.channelProvider.update({
        where: { id: ch.id },
        data: { status: "connected", errorMessage: null },
      });
      results.push({ id: ch.id, ok: true });
    } catch (err) {
      results.push({ id: ch.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, publicUrl: PUBLIC_URL, webhooksUpdated: results });
}
