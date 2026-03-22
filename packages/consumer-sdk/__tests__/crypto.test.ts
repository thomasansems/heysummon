import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  generateEphemeralKeys,
  generatePersistentKeys,
  loadPublicKeys,
  encrypt,
  decrypt,
} from "../src/crypto.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "hs-crypto-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("generateEphemeralKeys", () => {
  it("returns hex-encoded DER public keys", () => {
    const keys = generateEphemeralKeys();
    expect(keys.signPublicKey).toMatch(/^[0-9a-f]+$/);
    expect(keys.encryptPublicKey).toMatch(/^[0-9a-f]+$/);
    // Ed25519 SPKI DER is 44 bytes = 88 hex chars
    expect(keys.signPublicKey.length).toBe(88);
    // X25519 SPKI DER is 44 bytes = 88 hex chars
    expect(keys.encryptPublicKey.length).toBe(88);
  });

  it("generates different keys each call", () => {
    const a = generateEphemeralKeys();
    const b = generateEphemeralKeys();
    expect(a.signPublicKey).not.toBe(b.signPublicKey);
    expect(a.encryptPublicKey).not.toBe(b.encryptPublicKey);
  });
});

describe("generatePersistentKeys", () => {
  it("creates PEM files and returns hex DER keys", () => {
    const dir = join(tempDir, "keys");
    const keys = generatePersistentKeys(dir);

    expect(existsSync(join(dir, "sign_public.pem"))).toBe(true);
    expect(existsSync(join(dir, "sign_private.pem"))).toBe(true);
    expect(existsSync(join(dir, "encrypt_public.pem"))).toBe(true);
    expect(existsSync(join(dir, "encrypt_private.pem"))).toBe(true);

    expect(keys.signPublicKey).toMatch(/^[0-9a-f]+$/);
    expect(keys.encryptPublicKey).toMatch(/^[0-9a-f]+$/);
  });

  it("creates nested directories", () => {
    const dir = join(tempDir, "a", "b", "c");
    generatePersistentKeys(dir);
    expect(existsSync(join(dir, "sign_public.pem"))).toBe(true);
  });
});

describe("loadPublicKeys", () => {
  it("loads keys from existing PEM files", () => {
    const dir = join(tempDir, "keys");
    const generated = generatePersistentKeys(dir);
    const loaded = loadPublicKeys(dir);

    expect(loaded.signPublicKey).toBe(generated.signPublicKey);
    expect(loaded.encryptPublicKey).toBe(generated.encryptPublicKey);
  });

  it("throws if PEM files are missing", () => {
    expect(() => loadPublicKeys(join(tempDir, "empty"))).toThrow();
  });
});

describe("encrypt / decrypt round-trip", () => {
  it("encrypts and decrypts a message", () => {
    // Simulate two parties: Alice and Bob
    const aliceDir = join(tempDir, "alice");
    const bobDir = join(tempDir, "bob");
    generatePersistentKeys(aliceDir);
    generatePersistentKeys(bobDir);

    const plaintext = "Hello, Bob! This is a secret message.";

    // Alice encrypts for Bob
    const encrypted = encrypt(
      plaintext,
      join(bobDir, "encrypt_public.pem"),
      join(aliceDir, "sign_private.pem"),
      join(aliceDir, "encrypt_private.pem"),
      "test-message-001"
    );

    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.authTag).toBeTruthy();
    expect(encrypted.signature).toBeTruthy();
    expect(encrypted.messageId).toBe("test-message-001");

    // Bob decrypts from Alice
    const decrypted = decrypt(
      encrypted,
      join(aliceDir, "encrypt_public.pem"),
      join(aliceDir, "sign_public.pem"),
      join(bobDir, "encrypt_private.pem")
    );

    expect(decrypted).toBe(plaintext);
  });

  it("generates random messageId if not provided", () => {
    const dir = join(tempDir, "self");
    generatePersistentKeys(dir);

    const encrypted = encrypt(
      "test",
      join(dir, "encrypt_public.pem"),
      join(dir, "sign_private.pem"),
      join(dir, "encrypt_private.pem")
    );

    expect(encrypted.messageId).toBeTruthy();
    expect(encrypted.messageId.length).toBeGreaterThan(0);
  });

  it("fails with tampered signature", () => {
    const aliceDir = join(tempDir, "alice2");
    const bobDir = join(tempDir, "bob2");
    generatePersistentKeys(aliceDir);
    generatePersistentKeys(bobDir);

    const encrypted = encrypt(
      "secret",
      join(bobDir, "encrypt_public.pem"),
      join(aliceDir, "sign_private.pem"),
      join(aliceDir, "encrypt_private.pem")
    );

    // Tamper with signature
    encrypted.signature = Buffer.from("tampered").toString("base64");

    expect(() =>
      decrypt(
        encrypted,
        join(aliceDir, "encrypt_public.pem"),
        join(aliceDir, "sign_public.pem"),
        join(bobDir, "encrypt_private.pem")
      )
    ).toThrow("Signature verification failed");
  });
});
