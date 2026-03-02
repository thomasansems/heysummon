/**
 * MCP Full Circle — Combined Single Video (1600×900)
 *
 * One recording, split-screen:
 *   LEFT  (800px): Claude Code terminal — submits question via MCP
 *   RIGHT (800px): Telegram chat — provider receives notification, types reply
 *
 * The HeySummon platform handles routing in the background.
 * After the reply, Claude Code shows the answer.
 *
 * Run locally:
 *   BASE_URL=http://localhost:3456 \
 *   E2E_RATE_LIMIT_BYPASS_SECRET=test-bypass \
 *   npx playwright test mcp-full-circle-combined --headed
 */

import { test, chromium } from "@playwright/test";
import { execSync } from "child_process";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3456";
const BYPASS = process.env.E2E_RATE_LIMIT_BYPASS_SECRET || "test-bypass";
const VIDEO_OUT = "/tmp/playwright-heysummon/full-circle-combined";

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
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "x-e2e-bypass": BYPASS },
    body: JSON.stringify(body),
  });
}

// ── Full split-screen HTML ──
function buildHtml(question: string) {
  return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1600px; height:900px; display:flex; overflow:hidden; font-family:system-ui,sans-serif; }

/* ── LEFT: Claude Code terminal ── */
#left {
  width: 800px; height: 900px; flex-shrink:0;
  background: #0d1117; display:flex; flex-direction:column;
}
.titlebar {
  background:#161b22; border-bottom:1px solid #30363d;
  padding:10px 16px; display:flex; align-items:center; gap:8px; flex-shrink:0;
}
.dot { width:12px; height:12px; border-radius:50%; }
.dot-r{background:#ff5f57}.dot-y{background:#febc2e}.dot-g{background:#28c840}
.bar-title { color:#8b949e; font-size:12px; margin-left:8px; font-family:monospace; }
#terminal {
  flex:1; padding:20px; overflow-y:auto; font-family:'Cascadia Code','Fira Code',monospace;
  font-size:13px; color:#e6edf3; line-height:1.7;
}
.prompt { color:#58a6ff; }
.comment { color:#8b949e; }
.warn { color:#f0883e; }
.tool-block {
  background:#161b22; border:1px solid #30363d; border-left:3px solid #388bfd;
  border-radius:6px; padding:12px 16px; margin:10px 0;
}
.tool-title { color:#388bfd; font-weight:bold; font-size:11px; margin-bottom:6px; }
.tool-key { color:#8b949e; font-size:11px; }
.tool-val { color:#79c0ff; }
.wait-msg { color:#f0883e; }
.dots::after { content:'.'; animation:dots 1.2s infinite steps(3); }
@keyframes dots { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} }
.answer-block {
  background:#0d2818; border:1px solid #238636; border-left:3px solid #3fb950;
  border-radius:6px; padding:12px 16px; margin:10px 0;
}
.answer-title { color:#3fb950; font-size:11px; font-weight:bold; margin-bottom:6px; }
.answer-badge {
  display:inline-block; background:#1f6feb33; border:1px solid #388bfd;
  color:#79c0ff; font-size:10px; padding:1px 7px; border-radius:4px; margin-left:6px;
}
.answer-text { color:#aff5b4; font-size:12px; line-height:1.6; }
.success { color:#3fb950; }

/* divider */
#divider { width:1px; background:#30363d; flex-shrink:0; }

/* ── RIGHT: Telegram chat ── */
#right {
  width: 799px; height:900px; flex-shrink:0;
  background:#17212b; display:flex; flex-direction:column;
}
.tg-header {
  background:#232e3c; padding:12px 16px; display:flex; align-items:center;
  gap:12px; border-bottom:1px solid #0e1621; flex-shrink:0;
}
.tg-avatar {
  width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#db2777);
  display:flex; align-items:center; justify-content:center; color:#fff;
  font-weight:700; font-size:16px; flex-shrink:0;
}
.tg-name { color:#fff; font-weight:600; font-size:15px; }
.tg-sub { color:#8a9ab3; font-size:12px; }
.tg-badge {
  margin-left:auto; background:#7c3aed; color:#fff; font-size:11px;
  padding:2px 9px; border-radius:12px; font-weight:600;
}
#tg-messages {
  flex:1; padding:16px; overflow-y:auto; display:flex;
  flex-direction:column; gap:10px;
}
.tg-system {
  text-align:center; color:#8a9ab3; font-size:11px;
  background:#1f2f3f; border-radius:8px; padding:4px 10px;
  align-self:center; max-width:80%;
}
.tg-msg-wrap { display:flex; flex-direction:column; }
.tg-msg-wrap.bot { align-items:flex-start; }
.tg-msg-wrap.me { align-items:flex-end; }
.tg-bubble {
  max-width:78%; border-radius:12px; padding:10px 14px;
  font-size:13px; line-height:1.5; position:relative;
}
.tg-msg-wrap.bot .tg-bubble {
  background:#232e3c; color:#e8f1ff; border-bottom-left-radius:3px;
}
.tg-msg-wrap.me .tg-bubble {
  background:#2b5278; color:#e8f1ff; border-bottom-right-radius:3px;
}
.tg-meta { font-size:10px; color:#8a9ab3; margin-top:4px; padding:0 4px; }
.tg-label { font-size:10px; color:#8a9ab3; margin-bottom:3px; padding:0 4px; }
.tg-ref { font-size:11px; font-weight:700; color:#7c3aed; }
.tg-question-text { color:#e8f1ff; }
.tg-context { color:#8a9ab3; font-size:11px; font-style:italic; margin-top:4px; }
.tg-status { color:#3fb950; font-size:11px; margin-top:4px; }
.tg-input-row {
  background:#232e3c; padding:10px 12px; display:flex; align-items:center;
  gap:10px; border-top:1px solid #0e1621; flex-shrink:0;
}
#tg-input {
  flex:1; background:#17212b; border:none; outline:none; color:#fff;
  font-size:13px; padding:10px 14px; border-radius:20px;
  font-family:system-ui,sans-serif;
}
.tg-send-btn {
  width:38px; height:38px; border-radius:50%; background:#2b5278;
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:18px; cursor:pointer; flex-shrink:0;
  transition:background 0.2s;
}
.tg-send-btn:hover { background:#3a6fa8; }
</style>
</head>
<body>

<!-- LEFT: Claude Code -->
<div id="left">
  <div class="titlebar">
    <div class="dot dot-r"></div>
    <div class="dot dot-y"></div>
    <div class="dot dot-g"></div>
    <span class="bar-title">claude-code — /project/payment-service — bash</span>
  </div>
  <div id="terminal"></div>
</div>

<div id="divider"></div>

<!-- RIGHT: Telegram -->
<div id="right">
  <div class="tg-header">
    <div class="tg-avatar">H</div>
    <div>
      <div class="tg-name">heySummon Bot</div>
      <div class="tg-sub">bot</div>
    </div>
    <div class="tg-badge" id="tg-badge" style="display:none">1</div>
  </div>
  <div id="tg-messages">
    <div class="tg-system">Today</div>
  </div>
  <div class="tg-input-row">
    <input id="tg-input" placeholder="Message" />
    <div class="tg-send-btn">➤</div>
  </div>
</div>

<script>
const QUESTION = ${JSON.stringify(question)};
const term = document.getElementById('terminal');
const msgs = document.getElementById('tg-messages');

/* ── helpers ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function termLine(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  term.appendChild(d);
  term.scrollTop = 99999;
}

function tgMsg(side, html, meta = '') {
  const wrap = document.createElement('div');
  wrap.className = 'tg-msg-wrap ' + side;
  wrap.innerHTML = '<div class="tg-bubble">' + html + '</div>'
    + (meta ? '<div class="tg-meta">' + meta + '</div>' : '');
  msgs.appendChild(wrap);
  msgs.scrollTop = 99999;
  return wrap;
}

function tgSystem(text) {
  const d = document.createElement('div');
  d.className = 'tg-system';
  d.textContent = text;
  msgs.appendChild(d);
  msgs.scrollTop = 99999;
}

async function typeIntoInput(text) {
  const input = document.getElementById('tg-input');
  input.value = '';
  input.focus();
  for (const ch of text) {
    input.value += ch;
    await sleep(28 + Math.random() * 22);
  }
}

/* ── main flow ── */
async function run() {
  /* --- Claude terminal boot-up --- */
  await sleep(400);
  termLine('<span class="comment"># Working on payment service error handling...</span>');
  await sleep(600);
  termLine('<span class="prompt">claude ❯</span> implement robust error handling for payment-service.ts');
  await sleep(900);
  termLine('<span class="comment">● Reading src/services/payment.ts (312 lines)...</span>');
  await sleep(700);
  termLine('<span class="comment">● Reading src/lib/stripe.ts...</span>');
  await sleep(600);
  termLine('<span class="comment">● Analyzing async error patterns...</span>');
  await sleep(800);
  termLine('');
  termLine('<span class="warn">⚠  Uncertain: distributed partial-failure strategy.</span>');
  termLine('<span class="warn">   Multiple valid patterns — need human judgment.</span>');
  await sleep(700);
  termLine('');
  termLine('<span class="comment">  → Calling heySummon MCP tool...</span>');
  await sleep(500);

  const tb = document.createElement('div');
  tb.className = 'tool-block';
  tb.innerHTML = \`
    <div class="tool-title">⚙ Tool Use · heysummon</div>
    <div class="tool-key">question: <span class="tool-val">"\${QUESTION}"</span></div>
    <div class="tool-key">context:  <span class="tool-val">"src/services/payment.ts — Stripe charge + rollback"</span></div>
  \`;
  term.appendChild(tb);
  term.scrollTop = 99999;
  await sleep(400);

  const waitDiv = document.createElement('div');
  waitDiv.innerHTML = '<span class="wait-msg">⏳ Waiting for human expert<span class="dots"></span></span>';
  term.appendChild(waitDiv);
  term.scrollTop = 99999;

  window._termReady = true; // signal: ready to submit API call

  /* --- Telegram: incoming notification --- */
  await sleep(2200);
  document.getElementById('tg-badge').style.display = 'block';

  tgMsg('bot', \`
    <div><strong>🦞 New help request</strong></div>
    <div class="tg-ref" id="ref-placeholder">HS-......</div>
    <div style="margin:6px 0;border-top:1px solid #30363d"></div>
    <div class="tg-question-text">\${QUESTION}</div>
    <div class="tg-context">Context: payment.ts — Stripe async flow</div>
  \`, '11:07');

  await sleep(1200);
  document.getElementById('tg-badge').style.display = 'none';

  window._tgNotified = true; // signal: notification shown, ready for refCode

  /* wait for refCode to be set by Playwright */
  await new Promise(r => { const t = setInterval(() => { if (window._refCode) { clearInterval(t); r(); } }, 100); });
  document.getElementById('ref-placeholder').textContent = window._refCode;

  /* provider is typing */
  await sleep(1500);
  tgSystem('Thomas is typing...');
  await sleep(600);

  const REPLY = "Use idempotency keys + saga pattern. On failure: log the error, trigger a Stripe idempotent refund, and emit a compensating domain event. Never leave a charge without a matching record in your DB.";
  await typeIntoInput(REPLY);
  await sleep(800);

  /* remove typing indicator */
  const typing = msgs.querySelector('.tg-system:last-child');
  if (typing && typing.textContent === 'Thomas is typing...') typing.remove();

  /* send the reply bubble */
  document.getElementById('tg-input').value = '';
  tgMsg('me', REPLY, '11:08');
  await sleep(400);
  tgSystem('✅ Reply delivered to Claude Code');

  window._replyText = REPLY;
  window._replySent = true; // signal to Playwright: reply sent

  /* wait for Playwright to confirm API reply */
  await new Promise(r => { const t = setInterval(() => { if (window._apiDone) { clearInterval(t); r(); } }, 100); });

  /* --- Claude terminal: answer received --- */
  waitDiv.remove();
  const ab = document.createElement('div');
  ab.className = 'answer-block';
  ab.innerHTML = \`
    <div class="answer-title">💬 Expert response <span class="answer-badge" id="ref-badge">...</span></div>
    <div class="answer-text">\${REPLY}</div>
  \`;
  term.appendChild(ab);
  term.scrollTop = 99999;
  await sleep(300);
  document.getElementById('ref-badge').textContent = window._refCode;
  await sleep(500);
  termLine('<span class="success">✅ Implementing with idempotency keys + saga pattern...</span>');
  await sleep(200);
  termLine('<span class="comment">● Writing src/services/payment.ts...</span>');
  await sleep(600);
  termLine('<span class="comment">● Writing src/lib/saga.ts...</span>');
  await sleep(600);
  termLine('<span class="success">✓ Done.</span>');

  window._allDone = true;
}

run();
</script>
</body>
</html>`;
}

// ── Test ──
test("MCP Full Circle — combined split-screen video", async () => {
  test.setTimeout(180_000);

  const { providerKey, clientKey } = await seedKeys();
  const QUESTION = "What is the safest way to handle partial payment failures in a distributed TypeScript system?";

  fs.mkdirSync(VIDEO_OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: VIDEO_OUT, size: { width: 1600, height: 900 } },
  });
  const page = await ctx.newPage();

  // ── Load split-screen HTML ──
  await page.setContent(buildHtml(QUESTION));

  // ── Wait for terminal to be ready, then submit request ──
  await page.waitForFunction("window._termReady === true", { timeout: 15_000 });

  const { signPublicKey, encryptPublicKey } = generateKeys();
  const submitRes = await apiPost(`${BASE_URL}/api/v1/help`, clientKey, {
    apiKey: clientKey, signPublicKey, encryptPublicKey,
    question: QUESTION,
    messages: [{ role: "user", content: QUESTION }],
  });
  if (!submitRes.ok) throw new Error(`Submit failed: ${await submitRes.text()}`);
  const { requestId, refCode } = await submitRes.json();

  // ── Inject refCode into page ──
  await page.evaluate((rc: string) => { (window as any)._refCode = rc; }, refCode);

  // ── Wait for Telegram reply to be "sent" by the simulation ──
  await page.waitForFunction("window._replySent === true", { timeout: 30_000 });

  const replyText = await page.evaluate(() => (window as any)._replyText);

  // ── Send actual API reply ──
  const replyRes = await apiPost(`${BASE_URL}/api/v1/message/${requestId}`, providerKey, {
    from: "provider", plaintext: replyText,
  });
  if (!replyRes.ok) throw new Error(`Reply failed: ${await replyRes.text()}`);

  // ── Signal page that API call is done ──
  await page.evaluate(() => { (window as any)._apiDone = true; });

  // ── Wait for full animation to finish ──
  await page.waitForFunction("window._allDone === true", { timeout: 20_000 });
  await page.waitForTimeout(2000); // linger on final state

  // ── Save video ──
  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(VIDEO_OUT).filter(f => f.endsWith(".webm"));
  console.log(`\n🎬 Video: ${VIDEO_OUT}/${files[0]}`);
  console.log(`   Size: ${(fs.statSync(`${VIDEO_OUT}/${files[0]}`).size / 1024).toFixed(0)}KB`);
});
