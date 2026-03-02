/**
 * MCP Flow — Playwright E2E + Video
 *
 * Demonstrates the full HeySummon MCP flow:
 *   1. Seed: create provider + client API key
 *   2. Consumer (Claude Code / MCP server) submits a help request
 *   3. Dashboard: request appears in real-time
 *   4. Provider replies via API
 *   5. Dashboard: request marked as responded
 *
 * Video is recorded automatically (playwright.config.ts: video: "on").
 * Output dir: see outputDir in playwright.config.ts
 *
 * Run locally:
 *   BASE_URL=http://localhost:3456 npx playwright test mcp-flow --headed
 */

import { test, expect, Page } from "@playwright/test";
import { execSync } from "child_process";
import * as crypto from "crypto";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3456";
const DEMO_EMAIL = "demo@heysummon.ai";
const DEMO_PASSWORD = "demo1234";
const BYPASS_SECRET = process.env.E2E_RATE_LIMIT_BYPASS_SECRET || "test-bypass";

function bypassHeaders() {
  return BYPASS_SECRET ? { "x-e2e-bypass": BYPASS_SECRET } : {};
}

// ── Helpers ──

function generateKeys() {
  const sign = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const enc = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { signPublicKey: sign.publicKey, encryptPublicKey: enc.publicKey };
}

async function seedMcpKeys(): Promise<{ providerKey: string; clientKey: string; providerId: string }> {
  const script = path.resolve(__dirname, "../../e2e/seed-mcp.sh");
  const output = execSync(`bash ${script}`, { encoding: "utf-8" }).trim();
  const lines = output.split("\n");
  const json = lines[lines.length - 1];
  return JSON.parse(json);
}

async function submitHelpRequest(clientKey: string, question: string): Promise<{ requestId: string; refCode: string }> {
  const { signPublicKey, encryptPublicKey } = generateKeys();

  const res = await fetch(`${BASE_URL}/api/v1/help`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": clientKey, ...bypassHeaders() },
    body: JSON.stringify({ apiKey: clientKey, signPublicKey, encryptPublicKey, question, messages: [{ role: "user", content: question }] }),
  });

  if (!res.ok) throw new Error(`Submit failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { requestId: data.requestId, refCode: data.refCode };
}

async function sendProviderReply(providerKey: string, requestId: string, reply: string) {
  const res = await fetch(`${BASE_URL}/api/v1/message/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": providerKey, ...bypassHeaders() },
    body: JSON.stringify({ from: "provider", plaintext: reply }),
  });
  if (!res.ok) throw new Error(`Reply failed: ${res.status} ${await res.text()}`);
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector("#email", { state: "visible", timeout: 10000 });
  await page.locator("#email").fill(DEMO_EMAIL);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

// ── Test ──

test("MCP Flow: Claude asks → human replies → Claude gets answer", async ({ page }) => {
  test.setTimeout(60000);

  // ── Step 1: Seed test data ──
  const { providerKey, clientKey } = await seedMcpKeys();

  // ── Step 2: Open dashboard ──
  await login(page);
  await page.goto(`${BASE_URL}/dashboard`);
  await expect(page.locator("h1, h2").first()).toBeVisible();

  // Navigate to requests page
  await page.goto(`${BASE_URL}/dashboard/requests`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // ── Step 3: MCP server submits help request ──
  const question = `🤖 MCP Test ${Date.now()}: What is the best way to handle async errors in TypeScript?`;
  const { requestId, refCode } = await submitHelpRequest(clientKey, question);

  // ── Step 4: Dashboard shows new request ──
  await page.reload();
  await page.waitForTimeout(1500);

  // Look for the refCode or question in the page
  const refLocator = page.locator(`text=${refCode}`).first();
  await expect(refLocator).toBeVisible({ timeout: 15000 });

  // Click into the request
  await refLocator.click();
  await page.waitForTimeout(1000);

  // ── Step 5: Provider replies ──
  const reply = "Use try/catch with async/await. Type errors as 'unknown' then narrow with instanceof Error.";
  await sendProviderReply(providerKey, requestId, reply);
  await page.waitForTimeout(2000);

  // ── Step 6: Dashboard shows responded status ──
  await page.reload();
  await page.waitForTimeout(1500);

  // Verify the reply appears somewhere on the page
  const replyLocator = page.locator("text=responded").or(page.locator("text=Responded")).first();
  await expect(replyLocator).toBeVisible({ timeout: 10000 });

  // Final moment for video capture
  await page.waitForTimeout(2000);
});
