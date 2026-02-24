#!/usr/bin/env node
/**
 * Create a signed Guard receipt for E2E testing.
 *
 * Usage: node create-receipt.js [text] [timestamp_offset_ms]
 *
 * Env: GUARD_SIGNING_KEY (64 bytes hex)
 *
 * Output: JSON { token, signature }
 *   - timestamp_offset_ms: shift timestamp (e.g. -600000 for 10 min ago)
 */
const { sign } = require("tweetnacl");
const crypto = require("crypto");

const signingKey = Buffer.from(process.env.GUARD_SIGNING_KEY, "hex");
const text = process.argv[2] || "";
const tsOffset = parseInt(process.argv[3] || "0", 10);

const contentHash = crypto.createHash("sha256").update(text).digest("hex");
const payload = {
  contentHash,
  timestamp: Date.now() + tsOffset,
  nonce: crypto.randomBytes(16).toString("hex"),
};

const payloadBytes = Buffer.from(JSON.stringify(payload));
const signature = sign.detached(payloadBytes, signingKey);

console.log(
  JSON.stringify({
    token: payloadBytes.toString("base64"),
    signature: Buffer.from(signature).toString("base64"),
  })
);
