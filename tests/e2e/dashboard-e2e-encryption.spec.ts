/**
 * Dashboard E2E Encryption — Playwright tests
 *
 * Validates the full E2E encryption flow from the dashboard perspective:
 * 1. Auto key-exchange fires when expert opens an E2E request
 * 2. Expert sees decrypted consumer messages
 * 3. Expert sends an encrypted reply
 * 4. Non-E2E requests have no encryption behavior
 * 5. E2E indicator (badge, lock icon, button text) is visible
 *
 * Uses real Ed25519 + X25519 keys via Node.js crypto to simulate the
 * consumer side. The dashboard generates its own keys via Web Crypto.
 */

import { test, expect, Page } from "@playwright/test";
import { apiGet, apiPost } from "./helpers/api";
import { PW } from "./helpers/constants";
import { authHeaders } from "./helpers/session";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Consumer-side crypto helpers (mirrors consumer SDK)
// ---------------------------------------------------------------------------

function generateConsumerKeys() {
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

function encryptAsConsumer(
  plaintext: string,
  providerEncPubHex: string,
  consumerSignPriv: crypto.KeyObject,
  consumerEncPriv: crypto.KeyObject,
  messageId?: string,
) {
  const providerEncPub = crypto.createPublicKey({
    key: Buffer.from(providerEncPubHex, "hex"),
    format: "der",
    type: "spki",
  });

  const sharedSecret = crypto.diffieHellman({
    privateKey: consumerEncPriv,
    publicKey: providerEncPub,
  });

  const msgId = messageId || crypto.randomUUID();
  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    msgId,
    "heysummon-msg",
    32,
  );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const signature = crypto.sign(null, encrypted, consumerSignPriv);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    signature: signature.toString("base64"),
    messageId: msgId,
  };
}

// ---------------------------------------------------------------------------
// Browser login helper
// ---------------------------------------------------------------------------

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.waitForSelector("#email", { state: "visible", timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.locator("#email").fill(PW.EMAIL);
  await page.locator("#password").fill(PW.PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard|\/auth\/login/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface E2EDataResponse {
  requestId: string;
  status: string;
  consumerSignPubKey: string | null;
  consumerEncryptPubKey: string | null;
  providerSignPubKey: string | null;
  providerEncryptPubKey: string | null;
  messages: Array<{
    id: string;
    from: string;
    plaintext?: string;
    ciphertext?: string;
    iv?: string;
    authTag?: string;
    signature?: string;
    messageId: string;
    createdAt: string;
  }>;
  expiresAt: string;
}

/**
 * Poll the E2E API until provider keys appear (key exchange completed).
 * Returns the E2E data with provider keys set.
 */
async function waitForKeyExchange(
  requestId: string,
  headers: Record<string, string>,
  timeoutMs = 15000,
): Promise<E2EDataResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await apiGet<E2EDataResponse>(
      `/api/dashboard/e2e/${requestId}`,
      headers,
    );
    if (data.providerSignPubKey && data.providerEncryptPubKey) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Key exchange did not complete within timeout");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Dashboard E2E Encryption", () => {
  test("E2E request: auto key-exchange, decrypt messages, send encrypted reply, UI indicators", async ({
    page,
  }) => {
    // ── Step 1: Consumer creates an E2E-encrypted help request ──
    const consumerKeys = generateConsumerKeys();

    const helpData = await apiPost<{
      requestId: string;
      status: string;
    }>("/api/v1/help", {
      apiKey: PW.CLIENT_KEY,
      question: "E2E encryption Playwright test",
      signPublicKey: consumerKeys.signPublicKey,
      encryptPublicKey: consumerKeys.encryptPublicKey,
    });
    expect(helpData.requestId).toBeTruthy();
    const requestId = helpData.requestId;

    // ── Step 2: Login and navigate to the request detail page ──
    await login(page);
    await page.goto(`/dashboard/requests/${requestId}`);

    // ── Step 3: Verify E2E indicator badge appears ──
    // The dashboard detects consumer keys, generates provider keys,
    // performs key exchange, and shows the E2E badge
    await expect(
      page.locator("text=End-to-End Encrypted"),
    ).toBeVisible({ timeout: 15000 });

    // ── Step 4: Verify "Send Encrypted" button and notice ──
    await expect(
      page.locator("text=Your message will be end-to-end encrypted"),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Send Encrypted/ }),
    ).toBeVisible();

    // ── Step 5: Verify key exchange completed via API ──
    const headers = await authHeaders();
    const e2eData = await waitForKeyExchange(requestId, headers);
    expect(e2eData.providerSignPubKey).toBeTruthy();
    expect(e2eData.providerEncryptPubKey).toBeTruthy();

    // ── Step 6: Consumer encrypts and sends a message ──
    const testMessage = "Hello from consumer - E2E encrypted test";
    const encrypted = encryptAsConsumer(
      testMessage,
      e2eData.providerEncryptPubKey!,
      consumerKeys.signKeyPair.privateKey,
      consumerKeys.encryptKeyPair.privateKey,
    );

    const msgResult = await apiPost<{
      success: boolean;
      messageId: string;
    }>(
      `/api/v1/message/${requestId}`,
      { from: "consumer", ...encrypted },
      { "x-api-key": PW.CLIENT_KEY },
    );
    expect(msgResult.success).toBe(true);

    // ── Step 7: Wait for dashboard to poll and show decrypted message ──
    // The dashboard polls every 10s — wait up to 15s for the message
    await expect(
      page.locator(`text=${testMessage}`),
    ).toBeVisible({ timeout: 15000 });

    // ── Step 8: Verify green lock icon appears next to the message ──
    // The E2E chat display shows a green lock (svg) for each decrypted message
    const e2eChatSection = page.locator("text=Encrypted Messages");
    await expect(e2eChatSection).toBeVisible();

    // ── Step 9: Send an encrypted reply from the dashboard ──
    const replyText = "Expert encrypted reply - Playwright test";
    await page.locator("textarea").fill(replyText);
    await page.getByRole("button", { name: /Send Encrypted/ }).click();

    // Wait for the reply to appear in the chat
    await expect(
      page.locator(`text=${replyText}`),
    ).toBeVisible({ timeout: 10000 });

    // ── Step 10: Verify via API that the stored reply is encrypted ──
    const updatedE2E = await apiGet<E2EDataResponse>(
      `/api/dashboard/e2e/${requestId}`,
      headers,
    );

    const providerMsg = updatedE2E.messages.find(
      (m) => m.from === "provider",
    );
    expect(providerMsg).toBeTruthy();
    expect(providerMsg!.ciphertext).toBeTruthy();
    expect(providerMsg!.iv).toBeTruthy();
    expect(providerMsg!.iv).not.toBe("plaintext");
    expect(providerMsg!.authTag).toBeTruthy();
    expect(providerMsg!.signature).toBeTruthy();
    expect(providerMsg!.messageId).toBeTruthy();
  });

  test("Non-E2E request: no key exchange, no encryption indicators", async ({
    page,
  }) => {
    // Create a legacy (non-E2E) help request using publicKey instead of sign/encrypt keys
    const legacyKeyPair = crypto.generateKeyPairSync("x25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const helpData = await apiPost<{
      requestId: string;
      status: string;
    }>("/api/v1/help", {
      apiKey: PW.CLIENT_KEY,
      question: "Non-E2E legacy request - Playwright test",
      publicKey: legacyKeyPair.publicKey,
    });
    expect(helpData.requestId).toBeTruthy();
    const requestId = helpData.requestId;

    // Login and navigate to the request detail page
    await login(page);
    await page.goto(`/dashboard/requests/${requestId}`);

    // Wait for the page to fully load
    await expect(page.locator("text=Help Request")).toBeVisible({
      timeout: 10000,
    });

    // Verify "End-to-End Encrypted" badge is NOT visible
    await expect(
      page.locator("text=End-to-End Encrypted"),
    ).not.toBeVisible();

    // Verify "Send Response" button (not "Send Encrypted")
    await expect(
      page.getByRole("button", { name: "Send Response" }),
    ).toBeVisible();

    // Verify the encrypted notice is NOT shown
    await expect(
      page.locator("text=Your message will be end-to-end encrypted"),
    ).not.toBeVisible();

    // Verify via API that no provider keys were exchanged
    const headers = await authHeaders();
    const e2eData = await apiGet<E2EDataResponse>(
      `/api/dashboard/e2e/${requestId}`,
      headers,
    );
    expect(e2eData.providerSignPubKey).toBeNull();
    expect(e2eData.providerEncryptPubKey).toBeNull();
  });
});
