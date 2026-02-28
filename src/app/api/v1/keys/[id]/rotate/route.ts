import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDeviceSecret, hashDeviceToken } from "@/lib/api-key-auth";
import crypto from "crypto";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * POST /api/keys/[id]/rotate — Rotate an API key
 *
 * Session-authenticated. Generates a new key + device secret,
 * stores hash of old key with 24h grace period for seamless migration.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== user.id) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  if (!key.isActive) {
    return NextResponse.json({ error: "Cannot rotate an inactive key" }, { status: 400 });
  }

  // HMAC-SHA256: deterministic for DB lookup, but requires server secret to reverse.
  // Using NEXTAUTH_SECRET as HMAC key means an attacker with only DB access cannot
  // brute-force the original key from the stored hash.
  const hmacSecret = process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
  const previousKeyHash = crypto.createHmac("sha256", hmacSecret).update(key.key).digest("hex");
  const previousKeyExpiresAt = new Date(Date.now() + GRACE_PERIOD_MS);

  // Generate new key + device secret
  const newKey = generateApiKey();
  const deviceSecretPlaintext = generateDeviceSecret();
  const deviceSecretHash = hashDeviceToken(deviceSecretPlaintext);

  await prisma.apiKey.update({
    where: { id },
    data: {
      key: newKey,
      deviceSecret: deviceSecretHash,
      machineId: null, // Consumer must re-bind
      previousKeyHash,
      previousKeyExpiresAt,
    },
  });

  return NextResponse.json({
    key: newKey,
    deviceSecret: deviceSecretPlaintext,
    previousKeyExpiresAt: previousKeyExpiresAt.toISOString(),
    message: "Key rotated. Old key will remain valid until the grace period expires.",
  });
}
