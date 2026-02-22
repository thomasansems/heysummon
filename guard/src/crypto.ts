import crypto from "node:crypto";

const HMAC_SECRET = process.env.GUARD_HMAC_SECRET || "";

export interface EncryptedResult {
  encryptedPayload: string; // base64
  validationToken: string;
  timestamp: number;
  nonce: string;
}

/**
 * Encrypt content with AES-256-GCM and generate HMAC validation token
 */
export function encryptAndSign(sanitizedText: string): EncryptedResult {
  // Derive encryption key from HMAC secret (use separate derivation)
  const encKey = crypto
    .createHash("sha256")
    .update(HMAC_SECRET + ":encrypt")
    .digest();

  // AES-256-GCM encryption
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(sanitizedText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack as: iv (12) + authTag (16) + ciphertext
  const payload = Buffer.concat([iv, authTag, encrypted]);
  const encryptedPayload = payload.toString("base64");

  // Generate validation token
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const contentHash = crypto
    .createHash("sha256")
    .update(sanitizedText)
    .digest("hex");
  const message = `${contentHash}:${timestamp}:${nonce}`;
  const validationToken = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(message)
    .digest("hex");

  return { encryptedPayload, validationToken, timestamp, nonce };
}
