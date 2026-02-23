"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReceipt = createReceipt;
const node_crypto_1 = __importDefault(require("node:crypto"));
const tweetnacl_1 = require("tweetnacl");
const SIGNING_KEY = process.env.GUARD_SIGNING_KEY
    ? Buffer.from(process.env.GUARD_SIGNING_KEY, "hex")
    : null;
/**
 * Create a signed validation receipt using Ed25519.
 *
 * The receipt proves content passed through the Guard.
 * Platform verifies with the corresponding public key.
 */
function createReceipt(sanitizedText) {
    if (!SIGNING_KEY) {
        throw new Error("GUARD_SIGNING_KEY not configured");
    }
    const contentHash = node_crypto_1.default
        .createHash("sha256")
        .update(sanitizedText)
        .digest("hex");
    const payload = {
        contentHash,
        timestamp: Date.now(),
        nonce: node_crypto_1.default.randomBytes(16).toString("hex"),
    };
    const payloadBytes = Buffer.from(JSON.stringify(payload));
    const signatureBytes = tweetnacl_1.sign.detached(payloadBytes, SIGNING_KEY);
    return {
        token: payloadBytes.toString("base64"),
        signature: Buffer.from(signatureBytes).toString("base64"),
    };
}
