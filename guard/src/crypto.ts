import crypto from "node:crypto";
import { sign } from "tweetnacl";

const SIGNING_KEY = process.env.GUARD_SIGNING_KEY
  ? Buffer.from(process.env.GUARD_SIGNING_KEY, "hex")
  : null;

export interface GuardReceipt {
  /** Base64-encoded JSON receipt payload */
  token: string;
  /** Base64-encoded Ed25519 signature over the token bytes */
  signature: string;
}

export interface ReceiptPayload {
  contentHash: string;
  timestamp: number;
  nonce: string;
}

/**
 * Create a signed validation receipt using Ed25519.
 *
 * The receipt proves content passed through the Guard.
 * Platform verifies with the corresponding public key.
 */
export function createReceipt(sanitizedText: string): GuardReceipt {
  if (!SIGNING_KEY) {
    throw new Error("GUARD_SIGNING_KEY not configured");
  }

  const contentHash = crypto
    .createHash("sha256")
    .update(sanitizedText)
    .digest("hex");

  const payload: ReceiptPayload = {
    contentHash,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const signatureBytes = sign.detached(payloadBytes, SIGNING_KEY);

  return {
    token: payloadBytes.toString("base64"),
    signature: Buffer.from(signatureBytes).toString("base64"),
  };
}
