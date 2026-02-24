import { describe, it } from "node:test";
import * as assert from "node:assert";
import { generateSecret, generateSecrets } from "../lib/secrets";

describe("secrets", () => {
  it("generates a hex string of correct length", () => {
    const secret = generateSecret(32);
    assert.strictEqual(secret.length, 64); // 32 bytes = 64 hex chars
    assert.match(secret, /^[0-9a-f]{64}$/);
  });

  it("generates unique secrets each time", () => {
    const a = generateSecret();
    const b = generateSecret();
    assert.notStrictEqual(a, b);
  });

  it("generates both required secrets", () => {
    const secrets = generateSecrets();
    assert.ok(secrets.nextauthSecret);
    assert.ok(secrets.mercureJwtSecret);
    assert.match(secrets.nextauthSecret, /^[0-9a-f]{64}$/);
    assert.match(secrets.mercureJwtSecret, /^[0-9a-f]{64}$/);
    assert.notStrictEqual(secrets.nextauthSecret, secrets.mercureJwtSecret);
  });

  it("respects custom byte length", () => {
    const short = generateSecret(16);
    assert.strictEqual(short.length, 32); // 16 bytes = 32 hex chars
    assert.match(short, /^[0-9a-f]{32}$/);
  });
});
