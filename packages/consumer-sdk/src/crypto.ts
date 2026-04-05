import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface KeyPair {
  signPublicKey: string;
  encryptPublicKey: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  signature: string;
  messageId: string;
}

export interface KeyMaterial {
  signPublicKey: string;
  encryptPublicKey: string;
  signKeyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject };
  encryptKeyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject };
}

/**
 * Generate ephemeral Ed25519 + X25519 key pairs in memory.
 * Returns hex-encoded DER public keys for the HeySummon API.
 * Used by Claude Code (no file I/O needed).
 */
export function generateEphemeralKeys(): KeyPair {
  const signKeys = crypto.generateKeyPairSync("ed25519");
  const encKeys = crypto.generateKeyPairSync("x25519");

  return {
    signPublicKey: signKeys.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: encKeys.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

/**
 * Generate persistent Ed25519 + X25519 key pairs, writing PEM files to dir.
 * Returns hex-encoded DER public keys for the HeySummon API.
 * Used by OpenClaw (keys survive restarts).
 */
export function generatePersistentKeys(dir: string): KeyPair {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ed = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(path.join(dir, "sign_public.pem"), ed.publicKey);
  fs.writeFileSync(path.join(dir, "sign_private.pem"), ed.privateKey);

  const x = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(path.join(dir, "encrypt_public.pem"), x.publicKey);
  fs.writeFileSync(path.join(dir, "encrypt_private.pem"), x.privateKey);

  // Convert PEM to hex DER for the API
  return {
    signPublicKey: crypto
      .createPublicKey(ed.publicKey)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: crypto
      .createPublicKey(x.publicKey)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

/**
 * Load existing public keys from PEM files without regenerating.
 * Returns hex-encoded DER public keys for the HeySummon API.
 */
export function loadPublicKeys(dir: string): KeyPair {
  const signPem = fs.readFileSync(path.join(dir, "sign_public.pem"), "utf8");
  const encPem = fs.readFileSync(
    path.join(dir, "encrypt_public.pem"),
    "utf8"
  );

  return {
    signPublicKey: crypto
      .createPublicKey(signPem)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: crypto
      .createPublicKey(encPem)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

/**
 * Encrypt a plaintext message using X25519 DH + AES-256-GCM + Ed25519 signing.
 */
export function encrypt(
  plaintext: string,
  recipientX25519PubPath: string,
  ownSignPrivPath: string,
  ownEncPrivPath: string,
  messageId?: string
): {
  ciphertext: string;
  iv: string;
  authTag: string;
  signature: string;
  messageId: string;
} {
  const recipientPub = crypto.createPublicKey(
    fs.readFileSync(recipientX25519PubPath)
  );
  const ownEncPriv = crypto.createPrivateKey(fs.readFileSync(ownEncPrivPath));
  const signPriv = crypto.createPrivateKey(fs.readFileSync(ownSignPrivPath));

  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: recipientPub,
  });

  const msgId = messageId || crypto.randomUUID();

  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    msgId,
    "heysummon-msg",
    32
  );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const signature = crypto.sign(null, encrypted, signPriv);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    signature: signature.toString("base64"),
    messageId: msgId,
  };
}

/**
 * Decrypt an encrypted message, verifying the Ed25519 signature first.
 */
export function decrypt(
  payload: {
    ciphertext: string;
    iv: string;
    authTag: string;
    signature: string;
    messageId: string;
  },
  senderX25519PubPath: string,
  senderSignPubPath: string,
  ownEncPrivPath: string
): string {
  const senderPub = crypto.createPublicKey(
    fs.readFileSync(senderX25519PubPath)
  );
  const senderSignPub = crypto.createPublicKey(
    fs.readFileSync(senderSignPubPath)
  );
  const ownPriv = crypto.createPrivateKey(fs.readFileSync(ownEncPrivPath));

  const ciphertextBuf = Buffer.from(payload.ciphertext, "base64");
  const valid = crypto.verify(
    null,
    ciphertextBuf,
    senderSignPub,
    Buffer.from(payload.signature, "base64")
  );

  if (!valid) {
    throw new Error("Signature verification failed");
  }

  const sharedSecret = crypto.diffieHellman({
    privateKey: ownPriv,
    publicKey: senderPub,
  });

  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    payload.messageId,
    "heysummon-msg",
    32
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  return Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]).toString("utf8");
}

/**
 * Generate full key material (Ed25519 + X25519) with retained private keys.
 * Unlike generateEphemeralKeys(), private keys are kept as KeyObject instances
 * for use with encryptWithKeys/decryptWithKeys.
 */
export function generateKeyMaterial(): KeyMaterial {
  const signKeyPair = crypto.generateKeyPairSync("ed25519");
  const encryptKeyPair = crypto.generateKeyPairSync("x25519");

  return {
    signPublicKey: signKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: encryptKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    signKeyPair,
    encryptKeyPair,
  };
}

/**
 * Reconstruct a crypto.KeyObject from a hex-encoded DER public key.
 */
export function publicKeyFromHex(
  hex: string,
  type: "ed25519" | "x25519"
): crypto.KeyObject {
  const derBuffer = Buffer.from(hex, "hex");
  return crypto.createPublicKey({
    key: derBuffer,
    format: "der",
    type: "spki",
  });
}

/**
 * Encrypt plaintext using KeyObject instances directly (no file I/O).
 * Same X25519 DH + HKDF + AES-256-GCM + Ed25519 signing as encrypt().
 */
export function encryptWithKeys(
  plaintext: string,
  recipientEncryptPub: crypto.KeyObject,
  ownSignPriv: crypto.KeyObject,
  ownEncPriv: crypto.KeyObject,
  messageId?: string
): EncryptedPayload {
  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: recipientEncryptPub,
  });

  const msgId = messageId || crypto.randomUUID();

  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    msgId,
    "heysummon-msg",
    32
  );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const signature = crypto.sign(null, encrypted, ownSignPriv);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    signature: signature.toString("base64"),
    messageId: msgId,
  };
}

/**
 * Decrypt an encrypted payload using KeyObject instances directly (no file I/O).
 * Verifies the Ed25519 signature before decrypting.
 */
export function decryptWithKeys(
  payload: EncryptedPayload,
  senderEncryptPub: crypto.KeyObject,
  senderSignPub: crypto.KeyObject,
  ownEncPriv: crypto.KeyObject
): string {
  const ciphertextBuf = Buffer.from(payload.ciphertext, "base64");
  const valid = crypto.verify(
    null,
    ciphertextBuf,
    senderSignPub,
    Buffer.from(payload.signature, "base64")
  );

  if (!valid) {
    throw new Error("Signature verification failed");
  }

  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: senderEncryptPub,
  });

  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    payload.messageId,
    "heysummon-msg",
    32
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  return Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]).toString("utf8");
}
