import { describe, it, expect } from "vitest";
import { generateKeyPair, encryptMessage, decryptMessage } from "./crypto";

describe("generateKeyPair", () => {
  it("returns valid PEM public and private keys", () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey).toContain("BEGIN PUBLIC KEY");
    expect(privateKey).toContain("BEGIN PRIVATE KEY");
  });
});

describe("encryptMessage / decryptMessage roundtrip", () => {
  const { publicKey, privateKey } = generateKeyPair();

  it("encrypts and decrypts a message", () => {
    const msg = "Hello, HeySummon!";
    const encrypted = encryptMessage(msg, publicKey);
    expect(encrypted).not.toBe(msg);
    expect(decryptMessage(encrypted, privateKey)).toBe(msg);
  });

  it("handles empty message", () => {
    const encrypted = encryptMessage("", publicKey);
    expect(decryptMessage(encrypted, privateKey)).toBe("");
  });

  it("handles unicode / long messages", () => {
    const msg = "🔥".repeat(500);
    const encrypted = encryptMessage(msg, publicKey);
    expect(decryptMessage(encrypted, privateKey)).toBe(msg);
  });

  it("throws with invalid private key", () => {
    const other = generateKeyPair();
    const encrypted = encryptMessage("secret", publicKey);
    expect(() => decryptMessage(encrypted, other.privateKey)).toThrow();
  });

  it("throws with malformed ciphertext", () => {
    expect(() => decryptMessage("not.valid.cipher.text", privateKey)).toThrow();
  });
});
