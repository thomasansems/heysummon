import jwt from 'jsonwebtoken';

const MERCURE_HUB_URL = process.env.MERCURE_HUB_URL || 'http://localhost:3100/.well-known/mercure';
const MERCURE_JWT_SECRET = process.env.MERCURE_JWT_SECRET!;

if (!MERCURE_JWT_SECRET) {
  console.warn('⚠️  MERCURE_JWT_SECRET not set — Mercure publishing will fail');
}

export type MercureEvent = {
  type: 'new_request' | 'keys_exchanged' | 'new_message' | 'closed' | 'status_change' | 'responded';
  [key: string]: unknown;
};

/**
 * Publish an event to Mercure hub
 * @param topic - Mercure topic (e.g., /heysummon/providers/{id} or /heysummon/requests/{id})
 * @param data - Event data (will be JSON.stringify'd)
 * @param isPrivate - Whether this is a private update (default: true)
 */
export async function publishToMercure(
  topic: string,
  data: MercureEvent,
  isPrivate = false
): Promise<void> {
  if (!MERCURE_JWT_SECRET) {
    console.warn(`⚠️  Skipping Mercure publish to ${topic} (no JWT secret)`);
    return;
  }

  try {
    const token = jwt.sign(
      { mercure: { publish: [topic] } },
      MERCURE_JWT_SECRET,
      { algorithm: 'HS256' }
    );

    const body = new URLSearchParams({
      topic,
      data: JSON.stringify(data),
    });

    if (isPrivate) {
      body.append('private', 'on');
    }

    const response = await fetch(MERCURE_HUB_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mercure publish failed: ${response.status} ${text}`);
    }

    console.log(`✅ Published to Mercure topic: ${topic}`, { type: data.type });
  } catch (error) {
    console.error(`❌ Failed to publish to Mercure topic ${topic}:`, error);
    throw error;
  }
}

/**
 * Generate a subscriber JWT for client-side EventSource
 * @param topics - Topics the subscriber can access
 */
export function generateSubscriberJWT(topics: string[]): string {
  return jwt.sign(
    { mercure: { subscribe: topics } },
    MERCURE_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}
