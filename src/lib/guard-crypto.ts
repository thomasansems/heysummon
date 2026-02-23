import { sign } from "tweetnacl";

const MAX_RECEIPT_AGE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory nonce store with TTL cleanup.
 * Prevents replay attacks by rejecting duplicate nonces.
 */
const usedNonces = new Map<string, number>();

// Clean up expired nonces every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of usedNonces) {
    if (now > expiresAt) usedNonces.delete(nonce);
  }
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
 * Checks: signature validity, timestamp freshness, nonce uniqueness.
 */
export function verifyGuardReceipt(
  receiptB64: string,
  signatureB64: string
): ReceiptPayload | null {
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

  // Check nonce uniqueness (replay protection)
  if (usedNonces.has(payload.nonce)) {
    console.warn("Guard receipt rejected: nonce reused (replay detected)");
    return null;
  }
  usedNonces.set(payload.nonce, Date.now() + NONCE_TTL_MS);

  return payload;
}
