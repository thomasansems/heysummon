/**
 * MCP Full Circle — Playwright Video
 *
 * Shows the complete HeySummon MCP loop in one recording:
 *
 *   [Consumer view]                [Provider view]
 *   Claude Code asks a question →  Request appears in dashboard
 *   Waiting for human...        ←  Provider types + sends reply
 *   ✅ Got answer!                  Status → Responded
 *
 * Two browser contexts are opened side-by-side (viewport 1600×900):
 *   - Left half  (0,0,800,900): consumer terminal simulation
 *   - Right half (800,0,800,900): provider HeySummon dashboard
 *
 * Run locally:
 *   BASE_URL=http://localhost:3456 \
 *   E2E_RATE_LIMIT_BYPASS_SECRET=test-bypass \
 *   npx playwright test mcp-full-circle --headed
 */

import { test, chromium } from "@playwright/test";
import { execSync } from "child_process";
import * as crypto from "crypto";
import * as path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3456";
const DEMO_EMAIL = "demo@heysummon.ai";
const DEMO_PASSWORD = "demo1234";
const BYPASS = process.env.E2E_RATE_LIMIT_BYPASS_SECRET || "test-bypass";

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

async function seedKeys() {
  const script = path.resolve(__dirname, "../../e2e/seed-mcp.sh");
  const out = execSync(`bash ${script}`, { encoding: "utf-8" }).trim().split("\n").pop()!;
  return JSON.parse(out) as { providerKey: string; clientKey: string; providerId: string };
}

async function apiPost(url: string, apiKey: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-e2e-bypass": BYPASS,
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ── Consumer terminal HTML ──
function consumerHtml(question: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Claude Code — MCP Demo</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d1117; color: #e6edf3; font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
  .titlebar { background: #161b22; border-bottom: 1px solid #30363d; padding: 10px 16px; display: flex; align-items: center; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot-red { background: #ff5f57; }
  .dot-yellow { background: #febc2e; }
  .dot-green { background: #28c840; }
  .title { color: #8b949e; font-size: 12px; margin-left: 8px; }
  .terminal { flex: 1; padding: 20px; overflow-y: auto; }
  .line { margin-bottom: 6px; line-height: 1.6; }
  .prompt { color: #58a6ff; }
  .cmd { color: #e6edf3; }
  .comment { color: #8b949e; }
  .tool-call { background: #161b22; border: 1px solid #30363d; border-left: 3px solid #388bfd; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
  .tool-name { color: #388bfd; font-weight: bold; font-size: 12px; margin-bottom: 8px; }
  .tool-param { color: #8b949e; font-size: 11px; }
  .tool-param span { color: #79c0ff; }
  .waiting { color: #f0883e; }
  .waiting-dots::after { content: ''; animation: dots 1.5s infinite; }
  @keyframes dots { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} 100%{content:'.'} }
  .response { background: #0d2818; border: 1px solid #238636; border-left: 3px solid #3fb950; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
  .response-label { color: #3fb950; font-weight: bold; font-size: 12px; margin-bottom: 8px; }
  .response-text { color: #aff5b4; line-height: 1.6; }
  .badge { display: inline-block; background: #1f6feb33; border: 1px solid #388bfd; color: #79c0ff; font-size: 10px; padding: 2px 8px; border-radius: 4px; }
</style>
</head>
<body>
<div class="titlebar">
  <div class="dot dot-red"></div>
  <div class="dot dot-yellow"></div>
  <div class="dot dot-green"></div>
  <span class="title">claude-code — bash — 80×24</span>
</div>
<div class="terminal" id="terminal">
  <div class="line"><span class="comment"># Claude Code is working on a TypeScript project...</span></div>
  <div class="line">&nbsp;</div>
</div>
<script>
const Q = ${JSON.stringify(question)};
const terminal = document.getElementById('terminal');
let requestId = null;
let refCode = null;

function addLine(html, delay = 0) {
  return new Promise(r => setTimeout(() => {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
    r();
  }, delay));
}

function addBlock(html, delay = 0) {
  return new Promise(r => setTimeout(() => {
    const div = document.createElement('div');
    div.innerHTML = html;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
    r();
  }, delay));
}

async function run() {
  await addLine('<span class="prompt">claude ❯</span> <span class="cmd">implement error handling for the payment service</span>', 300);
  await addLine('&nbsp;', 500);
  await addLine('<span class="comment">● Analyzing codebase...</span>', 800);
  await addLine('<span class="comment">● Reading src/services/payment.ts...</span>', 1400);
  await addLine('&nbsp;', 1800);
  await addLine('<span class="comment">⚠ Uncertain about the right error handling strategy.</span>', 2000);
  await addLine('<span class="comment">  Calling heySummon to ask a human expert...</span>', 2600);
  await addLine('&nbsp;', 3000);

  await addBlock(\`<div class="tool-call">
    <div class="tool-name">🔧 Tool: heysummon</div>
    <div class="tool-param">question: <span>"\${Q}"</span></div>
    <div class="tool-param">context: <span>"src/services/payment.ts — async Stripe charge flow"</span></div>
  </div>\`, 3200);

  window._mcpReady = true; // signal to Playwright we're ready to submit

  await addLine('<span class="waiting">⏳ Waiting for human expert response<span class="waiting-dots"></span></span>', 3800);
}

run();
</script>
</body>
</html>`;
}

async function showConsumerResponse(consumerPage: any, answer: string, refCode: string) {
  await consumerPage.evaluate(
    ({ answer, refCode }: { answer: string; refCode: string }) => {
      const waiting = document.querySelector(".waiting");
      if (waiting) waiting.remove();
      const responseDiv = document.createElement("div");
      responseDiv.innerHTML = `
        <div class="response">
          <div class="response-label">💬 Expert response <span class="badge">${refCode}</span></div>
          <div class="response-text">${answer}</div>
        </div>`;
      document.getElementById("terminal")!.appendChild(responseDiv);
      setTimeout(() => {
        const finalLine = document.createElement("div");
        finalLine.className = "line";
        finalLine.innerHTML = '<span style="color:#3fb950">✅ Got expert answer. Continuing implementation...</span>';
        document.getElementById("terminal")!.appendChild(finalLine);
      }, 600);
    },
    { answer, refCode }
  );
}

// ── Test ──

test("MCP Full Circle: Claude asks → HeySummon dashboard → provider replies → Claude gets answer", async () => {
  test.setTimeout(120_000);

  const { providerKey, clientKey } = await seedKeys();
  const QUESTION = "What is the safest way to handle partial payment failures in a distributed TypeScript system?";
  const ANSWER = "Use idempotency keys + saga pattern. On failure: log the error, refund via Stripe's idempotent API, and emit a compensating event. Never leave a charge without a corresponding record.";

  // ── Open browser with wide viewport for split-screen feel ──
  const browser = await chromium.launch({ args: ["--window-size=1600,900"] });

  // Context A: Consumer terminal
  const consumerCtx = await browser.newContext({
    viewport: { width: 800, height: 900 },
    recordVideo: { dir: "/tmp/playwright-heysummon/full-circle/consumer", size: { width: 800, height: 900 } },
  });

  // Context B: Provider dashboard
  const providerCtx = await browser.newContext({
    viewport: { width: 800, height: 900 },
    recordVideo: { dir: "/tmp/playwright-heysummon/full-circle/provider", size: { width: 800, height: 900 } },
  });

  const consumerPage = await consumerCtx.newPage();
  const providerPage = await providerCtx.newPage();

  // ── CONSUMER: show terminal ──
  await consumerPage.setContent(consumerHtml(QUESTION));
  await consumerPage.waitForFunction("window._mcpReady === true", { timeout: 10_000 });

  // ── Submit help request (background) ──
  const { signPublicKey, encryptPublicKey } = generateKeys();
  const submitRes = await apiPost(`${BASE_URL}/api/v1/help`, clientKey, {
    apiKey: clientKey,
    signPublicKey,
    encryptPublicKey,
    question: QUESTION,
    messages: [{ role: "user", content: QUESTION }],
  });

  if (!submitRes.ok) throw new Error(`Submit failed: ${submitRes.status} ${await submitRes.text()}`);
  const { requestId, refCode } = await submitRes.json();

  // ── PROVIDER: login → dashboard → open request ──
  await providerPage.goto(`${BASE_URL}/auth/login`);
  await providerPage.waitForSelector("#email", { state: "visible", timeout: 10_000 });
  await providerPage.locator("#email").fill(DEMO_EMAIL);
  await providerPage.locator("#password").fill(DEMO_PASSWORD);
  await Promise.all([
    providerPage.waitForURL(/\/dashboard/, { timeout: 15_000 }),
    providerPage.locator('button[type="submit"]').click(),
  ]);

  // Navigate to requests
  await providerPage.goto(`${BASE_URL}/dashboard/requests`);
  await providerPage.waitForLoadState("domcontentloaded");
  await providerPage.waitForTimeout(1500);

  // Reload to see the new request
  await providerPage.reload();
  await providerPage.waitForTimeout(1000);

  // Find and click the request
  const refLocator = providerPage.locator(`text=${refCode}`).first();
  await refLocator.waitFor({ state: "visible", timeout: 15_000 });
  await providerPage.waitForTimeout(800);
  await refLocator.click();
  await providerPage.waitForLoadState("domcontentloaded");
  await providerPage.waitForTimeout(2000);

  // ── PROVIDER: reply via API (simulating Telegram/OpenClaw provider) ──
  // Show a "sending reply" indicator on provider page
  await providerPage.evaluate((answer) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #1a1a2e; border: 1px solid #7c3aed; border-radius: 12px;
      padding: 16px 20px; color: #fff; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 24px rgba(124,58,237,0.4);
      display: flex; flex-direction: column; gap: 8px; max-width: 320px;
    `;
    overlay.innerHTML = `
      <div style="color:#a78bfa;font-weight:bold;font-size:11px">📱 OpenClaw / Telegram</div>
      <div style="color:#d4d4f5;font-size:12px">Sending reply...</div>
      <div style="background:#0f0f1a;border-radius:8px;padding:10px;color:#c4b5fd;font-size:11px;line-height:1.5">"${answer}"</div>
    `;
    document.body.appendChild(overlay);
  }, ANSWER);

  await providerPage.waitForTimeout(2000);

  // Send the actual reply
  const replyRes = await apiPost(`${BASE_URL}/api/v1/message/${requestId}`, providerKey, {
    from: "provider",
    plaintext: ANSWER,
  });
  if (!replyRes.ok) throw new Error(`Reply failed: ${replyRes.status} ${await replyRes.text()}`);

  // Update overlay to "sent"
  await providerPage.evaluate(() => {
    const overlay = document.querySelector('[style*="position: fixed; bottom: 24px"]');
    if (overlay) {
      const status = overlay.querySelector('div:nth-child(2)') as HTMLElement;
      if (status) { status.textContent = "✅ Reply sent!"; status.style.color = "#4ade80"; }
    }
  });

  await providerPage.waitForTimeout(1500);

  // Reload provider to show responded status
  await providerPage.reload();
  await providerPage.waitForTimeout(2000);

  // ── CONSUMER: show response received ──
  await showConsumerResponse(consumerPage, ANSWER, refCode);
  await consumerPage.waitForTimeout(3000);

  // ── Done — close contexts first to flush video files ──
  await consumerCtx.close();
  await providerCtx.close();
  await browser.close();

  // Report video paths
  console.log("\n🎬 Videos saved:");
  console.log("  Consumer: /tmp/playwright-heysummon/full-circle/consumer/");
  console.log("  Provider: /tmp/playwright-heysummon/full-circle/provider/");
});
