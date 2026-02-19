import { generateKeyPairSync, publicEncrypt, privateDecrypt, randomBytes, createCipheriv, createDecipheriv, constants } from "node:crypto";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate an RSA-OAEP key pair (2048-bit).
 * Keys are returned as PEM-encoded strings.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

/**
 * Encrypt a message using hybrid RSA-OAEP + AES-256-GCM.
 * 1. Generate a random AES-256 key
 * 2. Encrypt the plaintext with AES-256-GCM
 * 3. Encrypt the AES key with RSA-OAEP
 * 4. Return base64-encoded bundle: encryptedKey|iv|authTag|ciphertext
 */
export function encryptMessage(plaintext: string, publicKey: string): string {
  // Generate random AES key and IV
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);

  // AES-256-GCM encrypt the plaintext
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // RSA-OAEP encrypt the AES key
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  // Bundle: encryptedKey|iv|authTag|ciphertext (all base64)
  const parts = [
    encryptedKey.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ];

  return parts.join(".");
}

/**
 * Decrypt a message encrypted with encryptMessage.
 */
export function decryptMessage(ciphertext: string, privateKey: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext format");
  }

  const [encKeyB64, ivB64, authTagB64, encDataB64] = parts;

  const encryptedKey = Buffer.from(encKeyB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encData = Buffer.from(encDataB64, "base64");

  // RSA-OAEP decrypt the AES key
  const aesKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
    encryptedKey
  );

  // AES-256-GCM decrypt the plaintext
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);

  return decrypted.toString("utf8");
}
