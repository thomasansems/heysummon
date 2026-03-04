import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyRequest } from '@/lib/api-key-auth';
import { dispatchWebhookToProvider } from '@/lib/webhook';

export async function POST(req: NextRequest) {
  const auth = await validateApiKeyRequest(req);
  if (!auth.ok) return auth.response;

  await dispatchWebhookToProvider(auth.apiKey.userId, {
    type: 'new_request',
    requestId: 'test-' + Date.now(),
    refCode: 'HS-TEST',
    question: '🧪 This is a test webhook from HeySummon. If you received this, your webhook is working!',
    messageCount: 1,
    test: true,
  });

  return NextResponse.json({ message: 'Test webhook dispatched.' });
}
