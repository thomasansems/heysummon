#!/usr/bin/env node
/**
 * Unit tests for crypto.mjs
 * 
 * Tests:
 * - Keygen creates valid keypairs
 * - Encrypt/decrypt roundtrip works
 * - Signature verification works
 * - Diffie-Hellman shared secret is identical for both parties
 * - Per-message keys are unique (HKDF with messageId as salt)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';

const CRYPTO_SCRIPT = path.join(import.meta.dirname, 'crypto.mjs');

// Test directories
const aliceDir = path.join(os.tmpdir(), 'hitlaas-test-alice');
const bobDir = path.join(os.tmpdir(), 'hitlaas-test-bob');

function cleanup() {
  [aliceDir, bobDir].forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  });
}

function runCrypto(args) {
  const cmd = `node ${CRYPTO_SCRIPT} ${args}`;
  const result = execSync(cmd, { encoding: 'utf8' });
  return result.trim();
}

console.log('🧪 Running crypto.mjs tests...\n');

// Cleanup before tests
cleanup();

// === Test 1: Keygen ===
console.log('Test 1: Keygen creates valid keypairs');
const aliceKeysJson = runCrypto(`keygen ${aliceDir}`);
const bobKeysJson = runCrypto(`keygen ${bobDir}`);

const aliceKeys = JSON.parse(aliceKeysJson.split('\n').pop()); // Last line is JSON
const bobKeys = JSON.parse(bobKeysJson.split('\n').pop());

assert(aliceKeys.signPublicKey.startsWith('-----BEGIN PUBLIC KEY-----'), 'Alice sign pubkey is PEM');
assert(aliceKeys.encryptPublicKey.startsWith('-----BEGIN PUBLIC KEY-----'), 'Alice encrypt pubkey is PEM');
assert(bobKeys.signPublicKey.startsWith('-----BEGIN PUBLIC KEY-----'), 'Bob sign pubkey is PEM');
assert(bobKeys.encryptPublicKey.startsWith('-----BEGIN PUBLIC KEY-----'), 'Bob encrypt pubkey is PEM');

assert(fs.existsSync(path.join(aliceDir, 'sign_public.pem')), 'Alice sign_public.pem exists');
assert(fs.existsSync(path.join(aliceDir, 'sign_private.pem')), 'Alice sign_private.pem exists');
assert(fs.existsSync(path.join(aliceDir, 'encrypt_public.pem')), 'Alice encrypt_public.pem exists');
assert(fs.existsSync(path.join(aliceDir, 'encrypt_private.pem')), 'Alice encrypt_private.pem exists');

console.log('✅ Keygen works\n');

// === Test 2: Encrypt/Decrypt Roundtrip ===
console.log('Test 2: Encrypt/Decrypt roundtrip (Alice → Bob)');

const plaintext = 'Hello from Alice! 🔐';
const messageId = 'test-msg-001';

// Alice encrypts a message for Bob
const encryptedJson = runCrypto(
  `encrypt "${plaintext}" ${bobDir}/encrypt_public.pem ${aliceDir}/sign_private.pem ${aliceDir}/encrypt_private.pem ${messageId}`
);

const encrypted = JSON.parse(encryptedJson);
assert(encrypted.ciphertext, 'ciphertext exists');
assert(encrypted.iv, 'iv exists');
assert(encrypted.authTag, 'authTag exists');
assert(encrypted.signature, 'signature exists');
assert.strictEqual(encrypted.messageId, messageId, 'messageId matches');

console.log('  Encrypted payload:', encrypted);

// Bob decrypts the message
const decrypted = runCrypto(
  `decrypt '${JSON.stringify(encrypted)}' ${aliceDir}/encrypt_public.pem ${aliceDir}/sign_public.pem ${bobDir}/encrypt_private.pem`
);

assert.strictEqual(decrypted, plaintext, 'Decrypted text matches original');
console.log(`  Decrypted: "${decrypted}"`);
console.log('✅ Roundtrip works\n');

// === Test 3: Signature Verification ===
console.log('Test 3: Signature verification fails on tampered ciphertext');

// Tamper with ciphertext
const tamperedPayload = { ...encrypted };
tamperedPayload.ciphertext = Buffer.from('tampered').toString('base64');

try {
  runCrypto(
    `decrypt '${JSON.stringify(tamperedPayload)}' ${aliceDir}/encrypt_public.pem ${aliceDir}/sign_public.pem ${bobDir}/encrypt_private.pem`
  );
  assert.fail('Should have failed signature verification');
} catch (err) {
  assert(err.message.includes('SIGNATURE VERIFICATION FAILED'), 'Signature verification detects tampering');
  console.log('✅ Signature verification works\n');
}

// === Test 4: Bob → Alice (reverse direction) ===
console.log('Test 4: Encrypt/Decrypt roundtrip (Bob → Alice)');

const plaintext2 = 'Reply from Bob 👍';
const messageId2 = 'test-msg-002';

// Bob encrypts a message for Alice
const encrypted2Json = runCrypto(
  `encrypt "${plaintext2}" ${aliceDir}/encrypt_public.pem ${bobDir}/sign_private.pem ${bobDir}/encrypt_private.pem ${messageId2}`
);

const encrypted2 = JSON.parse(encrypted2Json);

// Alice decrypts
const decrypted2 = runCrypto(
  `decrypt '${JSON.stringify(encrypted2)}' ${bobDir}/encrypt_public.pem ${bobDir}/sign_public.pem ${aliceDir}/encrypt_private.pem`
);

assert.strictEqual(decrypted2, plaintext2, 'Reverse direction works');
console.log(`  Decrypted: "${decrypted2}"`);
console.log('✅ Bidirectional encryption works\n');

// === Test 5: Per-message keys (HKDF) ===
console.log('Test 5: Per-message keys are unique (HKDF with different messageIds)');

const msg1 = runCrypto(
  `encrypt "Test" ${bobDir}/encrypt_public.pem ${aliceDir}/sign_private.pem ${aliceDir}/encrypt_private.pem msg-001`
);
const msg2 = runCrypto(
  `encrypt "Test" ${bobDir}/encrypt_public.pem ${aliceDir}/sign_private.pem ${aliceDir}/encrypt_private.pem msg-002`
);

const payload1 = JSON.parse(msg1);
const payload2 = JSON.parse(msg2);

// Same plaintext, different messageIds → different ciphertexts
assert.notStrictEqual(payload1.ciphertext, payload2.ciphertext, 'Different messageIds produce different ciphertexts');
console.log('✅ Per-message keys work (HKDF)\n');

// === Cleanup ===
cleanup();

console.log('🎉 All tests passed!\n');
