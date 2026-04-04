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
  generateKeyMaterial,
  publicKeyFromHex,
  encryptWithKeys,
  decryptWithKeys,
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

describe("generateKeyMaterial", () => {
  it("returns hex DER public keys and KeyObject pairs", () => {
    const km = generateKeyMaterial();

    expect(km.signPublicKey).toMatch(/^[0-9a-f]+$/);
    expect(km.encryptPublicKey).toMatch(/^[0-9a-f]+$/);
    expect(km.signPublicKey.length).toBe(88);
    expect(km.encryptPublicKey.length).toBe(88);

    expect(km.signKeyPair.publicKey.type).toBe("public");
    expect(km.signKeyPair.privateKey.type).toBe("private");
    expect(km.encryptKeyPair.publicKey.type).toBe("public");
    expect(km.encryptKeyPair.privateKey.type).toBe("private");
  });

  it("generates unique key material each call", () => {
    const a = generateKeyMaterial();
    const b = generateKeyMaterial();
    expect(a.signPublicKey).not.toBe(b.signPublicKey);
    expect(a.encryptPublicKey).not.toBe(b.encryptPublicKey);
  });
});

describe("publicKeyFromHex", () => {
  it("reconstructs ed25519 public key from hex", () => {
    const km = generateKeyMaterial();
    const reconstructed = publicKeyFromHex(km.signPublicKey, "ed25519");

    const originalDer = km.signKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex");
    const reconstructedDer = reconstructed
      .export({ type: "spki", format: "der" })
      .toString("hex");

    expect(reconstructedDer).toBe(originalDer);
  });

  it("reconstructs x25519 public key from hex", () => {
    const km = generateKeyMaterial();
    const reconstructed = publicKeyFromHex(km.encryptPublicKey, "x25519");

    const originalDer = km.encryptKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex");
    const reconstructedDer = reconstructed
      .export({ type: "spki", format: "der" })
      .toString("hex");

    expect(reconstructedDer).toBe(originalDer);
  });
});

describe("encryptWithKeys / decryptWithKeys round-trip", () => {
  it("encrypts and decrypts with in-memory keys", () => {
    const alice = generateKeyMaterial();
    const bob = generateKeyMaterial();

    const plaintext = "Hello from in-memory crypto!";

    const encrypted = encryptWithKeys(
      plaintext,
      bob.encryptKeyPair.publicKey,
      alice.signKeyPair.privateKey,
      alice.encryptKeyPair.privateKey,
      "test-inmem-001"
    );

    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.messageId).toBe("test-inmem-001");

    const decrypted = decryptWithKeys(
      encrypted,
      alice.encryptKeyPair.publicKey,
      alice.signKeyPair.publicKey,
      bob.encryptKeyPair.privateKey
    );

    expect(decrypted).toBe(plaintext);
  });

  it("generates random messageId when not provided", () => {
    const km = generateKeyMaterial();

    const encrypted = encryptWithKeys(
      "test",
      km.encryptKeyPair.publicKey,
      km.signKeyPair.privateKey,
      km.encryptKeyPair.privateKey
    );

    expect(encrypted.messageId).toBeTruthy();
    expect(encrypted.messageId.length).toBeGreaterThan(0);
  });

  it("fails with tampered signature", () => {
    const alice = generateKeyMaterial();
    const bob = generateKeyMaterial();

    const encrypted = encryptWithKeys(
      "secret",
      bob.encryptKeyPair.publicKey,
      alice.signKeyPair.privateKey,
      alice.encryptKeyPair.privateKey
    );

    encrypted.signature = Buffer.from("tampered").toString("base64");

    expect(() =>
      decryptWithKeys(
        encrypted,
        alice.encryptKeyPair.publicKey,
        alice.signKeyPair.publicKey,
        bob.encryptKeyPair.privateKey
      )
    ).toThrow("Signature verification failed");
  });

  it("interoperates with publicKeyFromHex for server-provided keys", () => {
    const alice = generateKeyMaterial();
    const bob = generateKeyMaterial();

    // Simulate receiving Bob's public keys as hex from the server
    const bobEncPub = publicKeyFromHex(bob.encryptPublicKey, "x25519");
    const aliceSignPub = publicKeyFromHex(alice.signPublicKey, "ed25519");
    const aliceEncPub = publicKeyFromHex(alice.encryptPublicKey, "x25519");

    const plaintext = "Cross-system interop test";

    const encrypted = encryptWithKeys(
      plaintext,
      bobEncPub,
      alice.signKeyPair.privateKey,
      alice.encryptKeyPair.privateKey
    );

    const decrypted = decryptWithKeys(
      encrypted,
      aliceEncPub,
      aliceSignPub,
      bob.encryptKeyPair.privateKey
    );

    expect(decrypted).toBe(plaintext);
  });
});
