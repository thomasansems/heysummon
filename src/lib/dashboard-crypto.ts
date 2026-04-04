/**
 * Dashboard E2E encryption using the Web Crypto API.
 *
 * Compatible with the consumer-sdk crypto module (X25519 DH + HKDF-SHA256
 * + AES-256-GCM + Ed25519 signing). Keys are CryptoKey objects held in
 * React refs — never persisted to storage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardKeyPair {
  signPublicKeyHex: string;
  encryptPublicKeyHex: string;
  signKeyPair: CryptoKeyPair;
  encryptKeyPair: CryptoKeyPair;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  signature: string; // base64
  messageId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

let _supported: boolean | null = null;

/**
 * Returns true when the browser supports Ed25519 and X25519 via
 * crypto.subtle.  Chrome 113+, Firefox 125+, Safari 17+.
 */
export async function isWebCryptoE2ESupported(): Promise<boolean> {
  if (_supported !== null) return _supported;
  try {
    const ed = await crypto.subtle.generateKey("Ed25519", false, [
      "sign",
      "verify",
    ]) as CryptoKeyPair;
    const x = await crypto.subtle.generateKey(
      { name: "X25519" },
      false,
      ["deriveBits"],
    ) as CryptoKeyPair;
    _supported = !!(ed?.privateKey && x?.privateKey);
  } catch {
    _supported = false;
  }
  return _supported;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generate Ed25519 (signing) + X25519 (encryption) keypairs using Web
 * Crypto. Returns hex-encoded SPKI DER public keys for the HeySummon API
 * plus the CryptoKeyPair objects for in-memory use.
 */
export async function generateDashboardKeys(): Promise<DashboardKeyPair> {
  const signKeyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const encryptKeyPair = (await crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const signPubDer = await crypto.subtle.exportKey("spki", signKeyPair.publicKey);
  const encPubDer = await crypto.subtle.exportKey("spki", encryptKeyPair.publicKey);

  return {
    signPublicKeyHex: bufToHex(signPubDer),
    encryptPublicKeyHex: bufToHex(encPubDer),
    signKeyPair,
    encryptKeyPair,
  };
}

// ---------------------------------------------------------------------------
// Import public keys from hex
// ---------------------------------------------------------------------------

async function importEd25519PublicKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    hexToBuf(hex),
    "Ed25519",
    true,
    ["verify"],
  );
}

async function importX25519PublicKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    hexToBuf(hex),
    { name: "X25519" },
    true,
    [],
  );
}

// ---------------------------------------------------------------------------
// Shared-secret derivation (X25519 DH + HKDF-SHA256)
// ---------------------------------------------------------------------------

async function deriveMessageKey(
  ownEncPriv: CryptoKey,
  recipientEncPub: CryptoKey,
  messageId: string,
): Promise<CryptoKey> {
  // X25519 Diffie-Hellman → 32-byte shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "X25519", public: recipientEncPub },
    ownEncPriv,
    256,
  );

  // Import shared secret as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const enc = new TextEncoder();

  // HKDF-SHA256 → AES-256-GCM key
  // Matches Node.js: hkdfSync("sha256", sharedSecret, messageId, "heysummon-msg", 32)
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(messageId),
      info: enc.encode("heysummon-msg"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext message for the consumer. Compatible with the
 * consumer-sdk `decryptWithKeys()` function.
 *
 * Flow: X25519 DH → HKDF → AES-256-GCM, then Ed25519-sign the ciphertext.
 */
export async function encryptDashboardMessage(
  text: string,
  consumerEncPubHex: string,
  ownSignPriv: CryptoKey,
  ownEncPriv: CryptoKey,
  messageId?: string,
): Promise<EncryptedPayload> {
  const msgId = messageId ?? crypto.randomUUID();

  const consumerEncPub = await importX25519PublicKey(consumerEncPubHex);
  const aesKey = await deriveMessageKey(ownEncPriv, consumerEncPub, msgId);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(text);

  // AES-256-GCM: Web Crypto appends the 16-byte auth tag to the ciphertext
  const combined = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    aesKey,
    plainBytes,
  );

  // Split: everything except last 16 bytes = ciphertext, last 16 = authTag
  const combinedBytes = new Uint8Array(combined);
  const ciphertext = combinedBytes.slice(0, combinedBytes.length - 16);
  const authTag = combinedBytes.slice(combinedBytes.length - 16);

  // Ed25519 sign the ciphertext (not the tag) — matches Node.js crypto.sign(null, ciphertext, privKey)
  const signature = await crypto.subtle.sign("Ed25519", ownSignPriv, ciphertext);

  return {
    ciphertext: bufToBase64(ciphertext.buffer),
    iv: bufToBase64(iv.buffer),
    authTag: bufToBase64(authTag.buffer),
    signature: bufToBase64(signature),
    messageId: msgId,
  };
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt an encrypted message from the consumer. Compatible with the
 * consumer-sdk `encryptWithKeys()` function.
 *
 * Handles plaintext messages (iv === "plaintext") by returning as-is.
 */
export async function decryptDashboardMessage(
  payload: {
    ciphertext: string;
    iv: string;
    authTag: string;
    signature: string;
    messageId: string;
  },
  consumerEncPubHex: string,
  ownEncPriv: CryptoKey,
  consumerSignPubHex: string,
): Promise<string> {
  // Plaintext passthrough (Telegram replies, etc.)
  if (payload.iv === "plaintext") {
    return atob(payload.ciphertext.replace(/^plaintext:/, ""));
  }

  const consumerSignPub = await importEd25519PublicKey(consumerSignPubHex);
  const ciphertextBuf = base64ToBuf(payload.ciphertext);

  // Verify Ed25519 signature over the raw ciphertext
  const sigBuf = base64ToBuf(payload.signature);
  const valid = await crypto.subtle.verify("Ed25519", consumerSignPub, sigBuf, ciphertextBuf);
  if (!valid) {
    throw new Error("Signature verification failed");
  }

  const consumerEncPub = await importX25519PublicKey(consumerEncPubHex);
  const aesKey = await deriveMessageKey(ownEncPriv, consumerEncPub, payload.messageId);

  // Reconstruct AES-GCM input: ciphertext || authTag
  const ciphertextBytes = new Uint8Array(ciphertextBuf);
  const authTagBytes = new Uint8Array(base64ToBuf(payload.authTag));
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes, 0);
  combined.set(authTagBytes, ciphertextBytes.length);

  const ivBuf = base64ToBuf(payload.iv);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf, tagLength: 128 },
    aesKey,
    combined,
  );

  return new TextDecoder().decode(plainBuf);
}
