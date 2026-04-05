import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TelegramConfig } from "@/lib/adapters/types";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL;
  if (!publicUrl) {
    return NextResponse.json({ error: "No public URL configured. Start Tailscale Funnel first." }, { status: 400 });
  }

  // Test 1: Is the public URL reachable?
  try {
    const res = await fetch(`${publicUrl}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: `Public URL returned HTTP ${res.status}. Is the tunnel active?` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: `Public URL ${publicUrl} is not reachable. Is Tailscale Funnel running?` }, { status: 400 });
  }

  // Test 2: Verify Telegram webhooks are registered correctly
  // Only check channels with a valid-looking bot token (not test/fake tokens)
  const channels = await prisma.expertChannel.findMany({
    where: { type: "telegram", isActive: true, status: { not: "error" } },
    select: { id: true, name: true, config: true, status: true },
  });

  const results = [];
  for (const ch of channels) {
    const cfg = JSON.parse(ch.config) as TelegramConfig;
    // Skip fake/placeholder tokens (real tokens are at least 40 chars)
    if (!cfg.botToken || cfg.botToken.startsWith("123456789") || cfg.botToken.length < 40) continue;
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getWebhookInfo`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (!data.ok) {
        results.push({ channel: ch.name, ok: false, lastError: "Invalid bot token" });
        continue;
      }
      const expectedUrl = `${publicUrl}/api/adapters/telegram/${ch.id}/webhook`;
      const currentUrl = data.result?.url ?? "";
      const ok = currentUrl === expectedUrl;
      results.push({
        channel: ch.name,
        ok,
        webhookUrl: currentUrl || "(none set)",
        expectedUrl,
        pendingCount: data.result?.pending_update_count ?? 0,
        lastError: data.result?.last_error_message ?? null,
      });
    } catch {
      results.push({ channel: ch.name, ok: false, lastError: "Could not reach Telegram API" });
    }
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({
    ok: allOk,
    publicUrl,
    tunnelReachable: true,
    webhooks: results,
    message: allOk
      ? "✅ All webhooks are correctly registered and reachable"
      : "⚠️ Some webhooks are misconfigured — click Start Tailscale Funnel to re-register",
  });
}
