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
const LOG_PATH = "/tmp/heysummon-cloudflared.log";

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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Kill any existing cloudflared tunnel
  try { execSync("pkill -f 'cloudflared tunnel' 2>/dev/null", { timeout: 3000 }); } catch { /* ignore */ }

  // Clear old log
  try { fs.unlinkSync(LOG_PATH); } catch { /* ignore */ }

  // Start cloudflared in background, capturing all output to log file
  execSync(
    `nohup cloudflared tunnel --url http://localhost:3425 --no-autoupdate > '${LOG_PATH}' 2>&1 &`,
    { timeout: 3000, shell: "/bin/bash" }
  );

  // Poll log file for the assigned URL (up to 15 seconds)
  let cfUrl: string | null = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const log = fs.readFileSync(LOG_PATH, "utf8");
      const match = log.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
      if (match) { cfUrl = match[0]; break; }
    } catch { /* log not written yet */ }
  }

  if (!cfUrl) {
    // Kill the process since we couldn't get a URL
    try { execSync("pkill -f 'cloudflared tunnel' 2>/dev/null", { timeout: 3000 }); } catch { /* ignore */ }
    return NextResponse.json(
      { error: "Could not obtain a Cloudflared URL. Is cloudflared installed and working?" },
      { status: 500 }
    );
  }

  // Persist to .env.local
  updateEnvVar("HEYSUMMON_PUBLIC_URL", cfUrl);
  process.env.HEYSUMMON_PUBLIC_URL = cfUrl;

  // Re-register all active Telegram channel webhooks
  const channels = await prisma.expertChannel.findMany({
    where: { type: "telegram", isActive: true },
  });

  for (const ch of channels) {
    try {
      const cfg = JSON.parse(ch.config) as TelegramConfig;
      if (!cfg.botToken) continue;
      const webhookSecret = cfg.webhookSecret ?? crypto.randomBytes(32).toString("hex");
      const webhookUrl = `${cfUrl}/api/adapters/telegram/${ch.id}/webhook`;
      await setWebhook(cfg.botToken, webhookUrl, webhookSecret);
      await prisma.expertChannel.update({
        where: { id: ch.id },
        data: {
          config: JSON.stringify({ ...cfg, webhookSecret }),
          status: "connected",
          errorMessage: null,
        },
      });
    } catch { /* continue — don't fail the whole request over one webhook */ }
  }

  return NextResponse.json({ ok: true, url: cfUrl });
}
