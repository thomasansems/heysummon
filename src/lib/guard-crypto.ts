import crypto from "node:crypto";

const MAX_NONCES = 1000;
const MAX_AGE_MS = 30_000; // 30 seconds
const seenNonces = new Set<string>();

/**
 * Verify HMAC validation token from guard service
 */
export function verifyValidationToken(
  token: string,
  sanitizedText: string,
  timestamp: number,
  nonce: string,
  secret: string
): boolean {
  // Replay protection: reject old timestamps
  if (Date.now() - timestamp > MAX_AGE_MS) {
    console.warn("Guard token rejected: timestamp too old");
    return false;
  }

  // Nonce replay protection
  if (seenNonces.has(nonce)) {
    console.warn("Guard token rejected: nonce reused");
    return false;
  }
  seenNonces.add(nonce);
  if (seenNonces.size > MAX_NONCES) {
    // Evict oldest (Sets iterate in insertion order)
    const first = seenNonces.values().next().value;
    if (first) seenNonces.delete(first);
  }

  // Verify HMAC
  const contentHash = crypto
    .createHash("sha256")
    .update(sanitizedText)
    .digest("hex");
  const message = `${contentHash}:${timestamp}:${nonce}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(expected, "hex")
  );
}
