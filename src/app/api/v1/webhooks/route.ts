/**
 * POST /api/v1/webhooks — Register a webhook endpoint for provider notifications
 * DELETE /api/v1/webhooks?id=... — Remove a webhook
 * GET /api/v1/webhooks — List configured webhooks
 *
 * Authentication: x-api-key (provider key)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKeyRequest } from '@/lib/api-key-auth';
import { requireJsonContentType } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/** Block webhook URLs pointing to private/internal networks */
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return true;
    }

    // Block private IP ranges (RFC1918, link-local, etc.)
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      if (parts[0] === 10) return true;                                    // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return true;              // 192.168.0.0/16
      if (parts[0] === 169 && parts[1] === 254) return true;              // 169.254.0.0/16 link-local
      if (parts[0] === 0) return true;                                     // 0.0.0.0/8
    }

    // Block metadata endpoints (cloud providers)
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return true;
    }

    // Require HTTPS for webhook URLs
    if (url.protocol !== 'https:') return true;

    return false;
  } catch {
    return true; // Invalid URL = block
  }
}

const RegisterSchema = z.object({
  url: z.string().url('Must be a valid URL').max(2048),
  name: z.string().min(1).max(100).optional(),
  secret: z.string().min(16).max(256).optional(),
  headers: z.record(z.string().max(256), z.string().max(4096)).optional(),
});

// POST /api/v1/webhooks — Register a webhook
export async function POST(req: NextRequest) {
  const ctError = requireJsonContentType(req);
  if (ctError) return ctError;

  const auth = await validateApiKeyRequest(req);
  if (!auth.ok) return auth.response;
  const userId = auth.apiKey.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const { url, name = 'My Webhook', secret, headers } = parsed.data;

  if (isPrivateUrl(url)) {
    return NextResponse.json(
      { error: 'Webhook URL must be a public HTTPS endpoint' },
      { status: 400 }
    );
  }

  const profile = await prisma.userProfile.findFirst({ where: { userId } });
  if (!profile) {
    return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 });
  }

  const webhookSecret = secret ?? crypto.randomBytes(32).toString('hex');

  const channel = await prisma.channelProvider.create({
    data: {
      profileId: profile.id,
      type: 'webhook',
      name,
      isActive: true,
      paired: true,
      config: JSON.stringify({ url, secret: webhookSecret, headers }),
    },
  });

  return NextResponse.json({
    id: channel.id,
    name,
    url,
    secret: webhookSecret,
    message: 'Webhook registered. Verify deliveries using X-HeySummon-Signature header.',
  }, { status: 201 });
}

// GET /api/v1/webhooks — List webhooks for this provider
export async function GET(req: NextRequest) {
  const auth = await validateApiKeyRequest(req);
  if (!auth.ok) return auth.response;
  const userId = auth.apiKey.userId;

  const profile = await prisma.userProfile.findFirst({
    where: { userId },
    include: {
      channelProviders: {
        where: { type: 'webhook' },
        select: { id: true, name: true, isActive: true, paired: true, createdAt: true, config: true },
      },
    },
  });

  const webhooks = (profile?.channelProviders ?? []).map((ch: { id: string; name: string; isActive: boolean; createdAt: Date; config: string }) => {
    let cfg: Record<string, unknown> = {};
    try { cfg = JSON.parse(ch.config); } catch { /* ignore */ }
    return { id: ch.id, name: ch.name, url: cfg.url, isActive: ch.isActive, createdAt: ch.createdAt };
  });

  return NextResponse.json({ webhooks });
}

// DELETE /api/v1/webhooks?id=... — Remove a webhook
export async function DELETE(req: NextRequest) {
  const auth = await validateApiKeyRequest(req);
  if (!auth.ok) return auth.response;
  const userId = auth.apiKey.userId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ?id parameter' }, { status: 400 });

  const profile = await prisma.userProfile.findFirst({ where: { userId } });
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const deleted = await prisma.channelProvider.deleteMany({
    where: { id, profileId: profile.id, type: 'webhook' },
  });

  return deleted.count > 0
    ? NextResponse.json({ message: 'Webhook removed' })
    : NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
}
