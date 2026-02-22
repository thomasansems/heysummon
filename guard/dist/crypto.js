"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAndSign = encryptAndSign;
const node_crypto_1 = __importDefault(require("node:crypto"));
const HMAC_SECRET = process.env.GUARD_HMAC_SECRET || "";
/**
 * Encrypt content with AES-256-GCM and generate HMAC validation token
 */
function encryptAndSign(sanitizedText) {
    // Derive encryption key from HMAC secret (use separate derivation)
    const encKey = node_crypto_1.default
        .createHash("sha256")
        .update(HMAC_SECRET + ":encrypt")
        .digest();
    // AES-256-GCM encryption
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", encKey, iv);
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
    const nonce = node_crypto_1.default.randomBytes(16).toString("hex");
    const contentHash = node_crypto_1.default
        .createHash("sha256")
        .update(sanitizedText)
        .digest("hex");
    const message = `${contentHash}:${timestamp}:${nonce}`;
    const validationToken = node_crypto_1.default
        .createHmac("sha256", HMAC_SECRET)
        .update(message)
        .digest("hex");
    return { encryptedPayload, validationToken, timestamp, nonce };
}
