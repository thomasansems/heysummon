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
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const RegisterSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  name: z.string().min(1).max(100).optional(),
  secret: z.string().min(16).max(256).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// POST /api/v1/webhooks — Register a webhook
export async function POST(req: NextRequest) {
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
