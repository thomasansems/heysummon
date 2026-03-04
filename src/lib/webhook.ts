/**
 * HeySummon Webhook Dispatcher
 *
 * Sends webhook notifications to registered provider endpoints.
 * Designed as a reliable alternative/complement to SSE via Mercure.
 *
 * Security: Each webhook delivery includes an HMAC-SHA256 signature
 * in the X-HeySummon-Signature header so the receiver can verify authenticity.
 *
 * Usage:
 *   // In your Next.js route handler after creating a help request:
 *   await dispatchWebhookToProvider(userId, { type: 'new_request', ... });
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export type WebhookPayload = {
  type: 'new_request' | 'new_message' | 'closed' | 'responded' | 'keys_exchanged';
  requestId?: string;
  refCode?: string;
  question?: string | null;
  messageCount?: number;
  messagePreview?: string | null;
  [key: string]: unknown;
};

export type WebhookConfig = {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retries?: number; // default: 2
};

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

/**
 * Sign a payload with HMAC-SHA256 using the webhook secret.
 */
function signPayload(payload: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Deliver a single webhook with retries.
 */
export async function deliverWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const retries = config.retries ?? MAX_RETRIES;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'HeySummon-Webhook/1.0',
    'X-HeySummon-Event': payload.type,
    'X-HeySummon-Timestamp': Date.now().toString(),
    ...config.headers,
  };

  if (config.secret) {
    headers['X-HeySummon-Signature'] = signPayload(body, config.secret);
  }

  let lastError: string = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      lastError = `HTTP ${res.status}`;

      // Don't retry on 4xx client errors (except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'unknown error';
    }

    // Exponential backoff: 1s, 2s
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  return { ok: false, error: lastError };
}

/**
 * Find all webhook ChannelProviders for a user and dispatch the payload to each.
 * Non-blocking: errors are logged but don't throw.
 */
export async function dispatchWebhookToProvider(
  userId: string,
  payload: WebhookPayload
): Promise<void> {
  let webhookProviders: Array<{ id: string; config: string; name: string }> = [];

  try {
    // Find all active webhook channels for this provider
    const profile = await prisma.userProfile.findFirst({
      where: { userId },
      include: {
        channelProviders: {
          where: {
            type: 'webhook',
            isActive: true,
            paired: true,
          },
          select: { id: true, config: true, name: true },
        },
      },
    });

    webhookProviders = profile?.channelProviders ?? [];
  } catch (err) {
    console.error('[webhook] Failed to fetch webhook providers:', err);
    return;
  }

  if (webhookProviders.length === 0) return;

  // Dispatch all in parallel (fire-and-forget per webhook)
  await Promise.allSettled(
    webhookProviders.map(async (ch) => {
      let cfg: WebhookConfig;
      try {
        cfg = JSON.parse(ch.config) as WebhookConfig;
      } catch {
        console.error(`[webhook] Invalid config for channel ${ch.id}`);
        return;
      }

      if (!cfg.url) {
        console.warn(`[webhook] No URL configured for channel ${ch.id}`);
        return;
      }

      const result = await deliverWebhook(cfg, payload);

      if (result.ok) {
        console.log(`[webhook] ✅ Delivered ${payload.type} to ${ch.name} (${cfg.url})`);
      } else {
        console.error(`[webhook] ❌ Failed ${payload.type} to ${ch.name}: ${result.error}`);
      }
    })
  );
}
