import { describe, it, expect } from "vitest";
import { generateKeyPair, encryptMessage, decryptMessage } from "./crypto";

describe("Relay Crypto (RSA-OAEP + AES-256-GCM)", () => {
  it("generates valid RSA key pair", () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(kp.privateKey).toContain("BEGIN PRIVATE KEY");
  });

  it("encrypts and decrypts roundtrip", () => {
    const kp = generateKeyPair();
    const plaintext = "Hello from HITLaaS relay!";
    const encrypted = encryptMessage(plaintext, kp.publicKey);
    const decrypted = decryptMessage(encrypted, kp.privateKey);
    expect(decrypted).toBe(plaintext);
  });

  it("encrypts JSON messages roundtrip", () => {
    const kp = generateKeyPair();
    const messages = JSON.stringify({
      messages: [
        { role: "user", content: "How do I fix JWT?" },
        { role: "assistant", content: "Let me try..." },
      ],
      question: "secretOrPublicKey error",
    });
    const encrypted = encryptMessage(messages, kp.publicKey);
    const decrypted = decryptMessage(encrypted, kp.privateKey);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(messages));
  });

  it("produces different ciphertexts for same plaintext", () => {
    const kp = generateKeyPair();
    const plaintext = "same message";
    const enc1 = encryptMessage(plaintext, kp.publicKey);
    const enc2 = encryptMessage(plaintext, kp.publicKey);
    expect(enc1).not.toBe(enc2);
  });

  it("ciphertext has 4 dot-separated parts", () => {
    const kp = generateKeyPair();
    const encrypted = encryptMessage("test", kp.publicKey);
    expect(encrypted.split(".").length).toBe(4);
  });

  it("fails to decrypt with wrong key", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const encrypted = encryptMessage("secret", kp1.publicKey);
    expect(() => decryptMessage(encrypted, kp2.privateKey)).toThrow();
  });

  it("fails on invalid ciphertext format", () => {
    const kp = generateKeyPair();
    expect(() => decryptMessage("invalid", kp.privateKey)).toThrow("Invalid ciphertext format");
  });

  it("handles large messages", () => {
    const kp = generateKeyPair();
    const large = "x".repeat(50000);
    const encrypted = encryptMessage(large, kp.publicKey);
    const decrypted = decryptMessage(encrypted, kp.privateKey);
    expect(decrypted).toBe(large);
  });

  it("handles unicode/emoji messages", () => {
    const kp = generateKeyPair();
    const msg = "Hé Thomas! 🦞 Dit is een test met ëë en €€€";
    const encrypted = encryptMessage(msg, kp.publicKey);
    const decrypted = decryptMessage(encrypted, kp.privateKey);
    expect(decrypted).toBe(msg);
  });
});
