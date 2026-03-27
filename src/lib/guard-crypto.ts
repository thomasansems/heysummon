import { sign } from "tweetnacl";
import { prisma } from "@/lib/prisma";

const MAX_RECEIPT_AGE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Background cleanup: delete expired nonces every 60 seconds.
// Fire-and-forget — must not block the request path.
setInterval(() => {
  prisma.usedNonce
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}, 60_000);

export interface ReceiptPayload {
  contentHash: string;
  timestamp: number;
  nonce: string;
}

/**
 * Verify an Ed25519-signed Guard receipt from request headers.
 *
 * Returns the parsed receipt payload if valid, or null if invalid.
 * Checks: signature validity, timestamp freshness, nonce uniqueness (DB-backed).
 */
export async function verifyGuardReceipt(
  receiptB64: string,
  signatureB64: string
): Promise<ReceiptPayload | null> {
  const publicKeyHex = process.env.GUARD_PUBLIC_KEY;
  if (!publicKeyHex) {
    console.error("GUARD_PUBLIC_KEY not configured");
    return null;
  }

  const publicKey = Buffer.from(publicKeyHex, "hex");

  // Verify Ed25519 signature
  const receiptBytes = Buffer.from(receiptB64, "base64");
  const signatureBytes = Buffer.from(signatureB64, "base64");

  let valid: boolean;
  try {
    valid = sign.detached.verify(
      new Uint8Array(receiptBytes),
      new Uint8Array(signatureBytes),
      new Uint8Array(publicKey)
    );
  } catch {
    console.warn("Guard receipt rejected: signature verification error");
    return null;
  }

  if (!valid) {
    console.warn("Guard receipt rejected: invalid signature");
    return null;
  }

  // Parse receipt payload
  let payload: ReceiptPayload;
  try {
    payload = JSON.parse(receiptBytes.toString());
  } catch {
    console.warn("Guard receipt rejected: malformed payload");
    return null;
  }

  // Check timestamp freshness
  const age = Date.now() - payload.timestamp;
  if (age > MAX_RECEIPT_AGE_MS || age < -30_000) {
    console.warn(
      `Guard receipt rejected: timestamp out of range (age: ${age}ms)`
    );
    return null;
  }

  // Check nonce uniqueness (DB-backed replay protection).
  // Atomic create: if the nonce already exists, the unique constraint throws.
  try {
    await prisma.usedNonce.create({
      data: {
        nonce: payload.nonce,
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      },
    });
  } catch {
    // Unique constraint violation = nonce already used
    console.warn("Guard receipt rejected: nonce reused (replay detected)");
    return null;
  }

  return payload;
}
