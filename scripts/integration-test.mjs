#!/usr/bin/env node
/**
 * Integration test: full flow consumer → key exchange → messages → close
 * 
 * Requires: HITLaaS running on localhost:3456, Mercure on localhost:3100
 * Usage: node scripts/integration-test.mjs <apiKey>
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';

const BASE_URL = process.env.HITLAAS_BASE_URL || 'http://localhost:3456';
const MERCURE_HUB = process.env.HITLAAS_MERCURE_HUB || 'http://localhost:3100/.well-known/mercure';
const API_KEY = process.argv[2];
const CRYPTO_SCRIPT = path.join(import.meta.dirname, 'crypto.mjs');

if (!API_KEY) {
  console.error('Usage: node scripts/integration-test.mjs <apiKey>');
  process.exit(1);
}

const consumerDir = path.join(os.tmpdir(), 'hitlaas-int-consumer');
const providerDir = path.join(os.tmpdir(), 'hitlaas-int-provider');

function cleanup() {
  [consumerDir, providerDir].forEach(d => {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
  });
}

function runCrypto(args) {
  return execSync(`node ${CRYPTO_SCRIPT} ${args}`, { encoding: 'utf8' }).trim();
}

async function api(method, endpoint, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  return res.json();
}

console.log('🧪 Integration test: full v4 flow\n');
cleanup();

// 1. Generate keypairs
console.log('1. Generating keypairs...');
const consumerKeys = JSON.parse(runCrypto(`keygen ${consumerDir}`).split('\n').pop());
const providerKeys = JSON.parse(runCrypto(`keygen ${providerDir}`).split('\n').pop());
console.log('   ✅ Consumer + Provider keypairs generated\n');

// 2. Submit help request
console.log('2. Submitting help request...');
const helpRes = await api('POST', '/api/v1/help', {
  apiKey: API_KEY,
  signPublicKey: consumerKeys.signPublicKey,
  encryptPublicKey: consumerKeys.encryptPublicKey,
});
assert(helpRes.requestId, 'Got requestId');
assert(helpRes.refCode, 'Got refCode');
assert.strictEqual(helpRes.status, 'pending');
console.log(`   ✅ Request created: ${helpRes.refCode} (${helpRes.requestId})\n`);

const requestId = helpRes.requestId;

// 3. Key exchange (provider sends keys)
console.log('3. Provider key exchange...');
const keyExRes = await api('POST', `/api/v1/key-exchange/${requestId}`, {
  signPublicKey: providerKeys.signPublicKey,
  encryptPublicKey: providerKeys.encryptPublicKey,
});
assert.strictEqual(keyExRes.success, true);
assert.strictEqual(keyExRes.status, 'active');
console.log('   ✅ Key exchange complete, status: active\n');

// 4. Provider sends encrypted message
console.log('4. Provider sends encrypted message...');
const providerMsg = 'Hello from provider! Try restarting the service.';
const encProvider = JSON.parse(runCrypto(
  `encrypt "${providerMsg}" ${consumerDir}/encrypt_public.pem ${providerDir}/sign_private.pem ${providerDir}/encrypt_private.pem msg-001`
));
const msgRes1 = await api('POST', `/api/v1/message/${requestId}`, {
  from: 'provider',
  ...encProvider,
});
assert.strictEqual(msgRes1.success, true);
console.log('   ✅ Provider message sent\n');

// 5. Consumer sends encrypted message
console.log('5. Consumer sends encrypted message...');
const consumerMsg = 'Thanks! That worked perfectly.';
const encConsumer = JSON.parse(runCrypto(
  `encrypt "${consumerMsg}" ${providerDir}/encrypt_public.pem ${consumerDir}/sign_private.pem ${consumerDir}/encrypt_private.pem msg-002`
));
const msgRes2 = await api('POST', `/api/v1/message/${requestId}`, {
  from: 'consumer',
  ...encConsumer,
});
assert.strictEqual(msgRes2.success, true);
console.log('   ✅ Consumer message sent\n');

// 6. Fetch and decrypt messages
console.log('6. Fetching and decrypting messages...');
const msgsRes = await api('GET', `/api/v1/messages/${requestId}`);
assert.strictEqual(msgsRes.messages.length, 2);

// Consumer decrypts provider's message
const providerMsgData = msgsRes.messages.find(m => m.from === 'provider');
const decProvider = runCrypto(
  `decrypt '${JSON.stringify(providerMsgData)}' ${providerDir}/encrypt_public.pem ${providerDir}/sign_public.pem ${consumerDir}/encrypt_private.pem`
);
assert.strictEqual(decProvider, providerMsg);
console.log(`   Provider → Consumer: "${decProvider}"`);

// Provider decrypts consumer's message
const consumerMsgData = msgsRes.messages.find(m => m.from === 'consumer');
const decConsumer = runCrypto(
  `decrypt '${JSON.stringify(consumerMsgData)}' ${consumerDir}/encrypt_public.pem ${consumerDir}/sign_public.pem ${providerDir}/encrypt_private.pem`
);
assert.strictEqual(decConsumer, consumerMsg);
console.log(`   Consumer → Provider: "${decConsumer}"`);
console.log('   ✅ All messages decrypted correctly\n');

// 7. Idempotent message (duplicate messageId)
console.log('7. Testing idempotent message (duplicate)...');
const dupRes = await api('POST', `/api/v1/message/${requestId}`, {
  from: 'provider',
  ...encProvider,
});
assert.strictEqual(dupRes.success, true);
assert.strictEqual(dupRes.duplicate, true);
console.log('   ✅ Duplicate message handled correctly\n');

// 8. Close conversation
console.log('8. Closing conversation...');
const closeRes = await api('POST', `/api/v1/close/${requestId}`);
assert.strictEqual(closeRes.success, true);
assert.strictEqual(closeRes.status, 'closed');
console.log('   ✅ Conversation closed\n');

// 9. Verify closed state
console.log('9. Verifying closed state...');
const closedMsgs = await api('GET', `/api/v1/messages/${requestId}`);
assert.strictEqual(closedMsgs.status, 'closed');

// Try sending after close
const afterClose = await api('POST', `/api/v1/message/${requestId}`, {
  from: 'provider',
  ciphertext: 'x', iv: 'x', authTag: 'x', signature: 'x', messageId: 'msg-003',
});
assert(afterClose.error, 'Cannot send after close');
console.log('   ✅ Cannot send messages after close\n');

// 10. Idempotent close
console.log('10. Testing idempotent close...');
const closeAgain = await api('POST', `/api/v1/close/${requestId}`);
assert.strictEqual(closeAgain.success, true);
console.log('    ✅ Idempotent close works\n');

cleanup();
console.log('🎉 All integration tests passed!\n');
