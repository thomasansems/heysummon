/**
 * Generate Ed25519 key pair for Guard ↔ Platform signing.
 *
 * Guard holds the private key (signs validation receipts).
 * Platform holds the public key (verifies receipts).
 *
 * Usage:
 *   npx tsx scripts/generate-guard-keys.ts
 *
 * Outputs hex-encoded keys to stdout (copy into .env).
 */
import { sign } from "tweetnacl";

const keyPair = sign.keyPair();

const privateKeyHex = Buffer.from(keyPair.secretKey).toString("hex");
const publicKeyHex = Buffer.from(keyPair.publicKey).toString("hex");

console.log("# Guard Ed25519 Key Pair");
console.log("# Add these to your .env file\n");
console.log(`GUARD_SIGNING_KEY=${privateKeyHex}`);
console.log(`GUARD_PUBLIC_KEY=${publicKeyHex}`);
