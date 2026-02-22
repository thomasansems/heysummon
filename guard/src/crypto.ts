import crypto from "node:crypto";

const HMAC_SECRET = process.env.GUARD_HMAC_SECRET || "";

export interface SignedResult {
  signature: string;
  timestamp: number;
  nonce: string;
}

/**
 * Sign sanitized content with HMAC-SHA256.
 * The signature proves this content was validated by the guard.
 * No encryption — the platform handles encryption at rest.
 */
export function signContent(sanitizedText: string): SignedResult {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const contentHash = crypto
    .createHash("sha256")
    .update(sanitizedText)
    .digest("hex");
  const message = `${contentHash}:${timestamp}:${nonce}`;
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(message)
    .digest("hex");

  return { signature, timestamp, nonce };
}
