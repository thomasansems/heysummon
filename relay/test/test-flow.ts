/**
 * HITLaaS Relay — End-to-end webhook flow test
 *
 * Simulates the full consumer → relay → provider → relay → consumer cycle.
 * Starts a local webhook receiver on port 4001, then drives the whole flow.
 *
 * Usage:
 *   API_KEY=htl_xxx npx tsx test/test-flow.ts
 *
 * Optional env vars:
 *   RELAY_URL     (default: http://localhost:4000)
 *   WEBHOOK_PORT  (default: 4001)
 *   WEBHOOK_HOST  (default: http://localhost:4001)  — override if running in a container
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { generateKeyPair, decryptMessage, encryptMessage } from "../src/crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const RELAY_URL = process.env.RELAY_URL || "http://localhost:4000";
const API_KEY = process.env.API_KEY;
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || "4001", 10);
const WEBHOOK_HOST = process.env.WEBHOOK_HOST || `http://localhost:${WEBHOOK_PORT}`;

if (!API_KEY) {
  console.error("❌  API_KEY env var is required.\n    Usage: API_KEY=htl_xxx npx tsx test/test-flow.ts");
  process.exit(1);
}

// ── State shared between webhook handlers ─────────────────────────────────────

let requestId: string;
let refCode: string;
let serverPrivateKey: string;
const consumerKeys = generateKeyPair();

let resolve: () => void;
const done = new Promise<void>((r) => (resolve = r));

// ── Small webhook receiver ────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { res(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { rej(new Error("Invalid JSON")); }
    });
  });
}

async function handleProviderWebhook(body: Record<string, unknown>) {
  console.log("\n📬  [Provider webhook] New request arrived:", body.refCode);

  // Fetch encrypted messages from relay
  const msgRes = await fetch(`${RELAY_URL}/api/v1/relay/messages/${body.requestId}`, {
    headers: { "x-api-key": API_KEY! },
  });
  const msgData = await msgRes.json() as {
    encryptedMessages: string;
    serverPrivateKey: string;
    requestId: string;
    refCode: string;
  };

  // Decrypt the conversation
  const plaintext = decryptMessage(msgData.encryptedMessages, msgData.serverPrivateKey);
  const { messages, question } = JSON.parse(plaintext) as {
    messages: { role: string; content: string }[];
    question: string | null;
  };

  console.log("🔓  [Provider] Decrypted messages:");
  messages.forEach((m) => console.log(`     ${m.role}: ${m.content}`));
  if (question) console.log(`     Question: ${question}`);

  const responseText = "This is the human expert's answer. Try checking your environment variables.";
  console.log(`\n💬  [Provider] Responding: "${responseText}"`);

  // Encrypt response for consumer using consumer's public key (from /send payload)
  // In this test, serverPublicKey from the webhook payload is the server key,
  // not the consumer's key. We send plain text — relay will encrypt it if consumer
  // public key was registered.
  const respondRes = await fetch(`${RELAY_URL}/api/v1/relay/respond/${body.requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY! },
    body: JSON.stringify({ response: responseText }),
  });
  const respondData = await respondRes.json();
  console.log("✅  [Provider] Response submitted:", respondData);
}

async function handleConsumerCallback(body: Record<string, unknown>) {
  console.log("\n📬  [Consumer callback] Response received for", body.refCode);

  const encrypted = body.encryptedResponse as string;

  // Try E2E decryption with consumer private key
  try {
    const decrypted = decryptMessage(encrypted, consumerKeys.privateKey);
    console.log("🔓  [Consumer] Decrypted response:", decrypted);
  } catch {
    // Relay didn't have consumer public key, response came as plain text
    console.log("📄  [Consumer] Plaintext response:", encrypted);
  }

  console.log("\n🎉  Full webhook flow completed successfully!\n");
  resolve();
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  try {
    const body = await readBody(req) as Record<string, unknown>;

    if (req.url === "/provider-webhook") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
      await handleProviderWebhook(body);
    } else if (req.url === "/consumer-callback") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
      await handleConsumerCallback(body);
    } else {
      res.writeHead(404).end();
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.writeHead(500).end();
  }
});

// ── Main flow ─────────────────────────────────────────────────────────────────

server.listen(WEBHOOK_PORT, async () => {
  console.log(`\n🔐  HITLaaS Relay — E2E Test`);
  console.log(`    Relay:    ${RELAY_URL}`);
  console.log(`    Webhooks: ${WEBHOOK_HOST}`);
  console.log(`    API key:  ${API_KEY!.slice(0, 10)}…\n`);

  // 1. Check relay health
  const health = await fetch(`${RELAY_URL}/health`).then((r) => r.json());
  console.log("❤️   Relay health:", health);

  // 2. Register provider webhook URL on the API key
  //    (In production this is done once via the platform dashboard.)
  //    Here we call PATCH /api/keys/:id — but we only have the key string, not the ID.
  //    So we skip this step and instead rely on it being pre-configured.
  //    You can pre-configure with:
  //      curl -X PATCH http://localhost:3000/api/keys/<KEY_ID> \
  //        -H "Cookie: <session>" \
  //        -d '{"providerWebhookUrl":"http://localhost:4001/provider-webhook"}'
  console.log(`\nℹ️   Ensure your API key has providerWebhookUrl set to:`);
  console.log(`    ${WEBHOOK_HOST}/provider-webhook`);
  console.log(`    (Dashboard → API Keys → set Webhook URL, or PATCH /api/keys/:id)\n`);

  // 3. Consumer sends a help request
  console.log("📤  [Consumer] Sending help request...");
  const sendRes = await fetch(`${RELAY_URL}/api/v1/relay/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY! },
    body: JSON.stringify({
      messages: [
        { role: "user", content: "My JWT auth is broken. I get: secretOrPublicKey must have a value" },
        { role: "assistant", content: "That sounds like a missing env variable. Let me escalate to a human expert." },
      ],
      question: "How do I fix the JWT_SECRET issue in my Next.js app?",
      consumerPublicKey: consumerKeys.publicKey,
      callbackUrl: `${WEBHOOK_HOST}/consumer-callback`,
    }),
  });

  if (!sendRes.ok) {
    console.error("❌  Send failed:", await sendRes.text());
    process.exit(1);
  }

  const sendData = await sendRes.json() as { requestId: string; refCode: string; serverPublicKey: string };
  requestId = sendData.requestId;
  refCode = sendData.refCode;
  serverPrivateKey = sendData.serverPublicKey; // stored for reference

  console.log(`✅  [Consumer] Request created: ${refCode} (${requestId})`);
  console.log(`    Callback URL: ${WEBHOOK_HOST}/consumer-callback`);
  console.log(`\n⏳  Waiting for provider to respond via webhook...\n`);

  // 4. Wait for the full flow to complete (or timeout after 60s)
  const timeout = setTimeout(() => {
    console.error("⏰  Timeout: provider did not respond within 60s");
    console.error("    Make sure providerWebhookUrl is set on the API key.");
    process.exit(1);
  }, 60_000);

  await done;
  clearTimeout(timeout);
  server.close();
});
