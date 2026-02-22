"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signContent = signContent;
const node_crypto_1 = require("node:crypto");
const HMAC_SECRET = process.env.GUARD_HMAC_SECRET || "";
function signContent(sanitizedText) {
    const timestamp = Date.now();
    const nonce = node_crypto_1.default.randomBytes(16).toString("hex");
    const contentHash = node_crypto_1.default.createHash("sha256").update(sanitizedText).digest("hex");
    const message = `${contentHash}:${timestamp}:${nonce}`;
    const signature = node_crypto_1.default.createHmac("sha256", HMAC_SECRET).update(message).digest("hex");
    return { signature, timestamp, nonce };
}
