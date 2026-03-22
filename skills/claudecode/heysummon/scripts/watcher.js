#!/usr/bin/env node
/**
 * HeySummon Claude Code Watcher — PM2-managed persistent poller
 *
 * Polls all pending requests in pending/ directory and writes responses
 * to inbox/ when humans respond. This ensures responses arriving after
 * the blocking poll timeout are still captured in the current session.
 *
 * PM2 process name: heysummon-cc-watcher (distinct from OpenClaw's heysummon-watcher)
 *
 * Directories:
 *   pending/  — {requestId}.json files for active requests
 *   inbox/    — {requestId}.json files with received responses
 *   logs/     — watcher.log
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Resolve directories relative to skill dir
const SCRIPT_DIR = __dirname;
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');

// Load .env
const envFile = path.join(SKILL_DIR, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const BASE_URL = process.env.HEYSUMMON_BASE_URL || 'http://localhost:3425';
const API_KEY = process.env.HEYSUMMON_API_KEY || '';
const POLL_INTERVAL = parseInt(process.env.HEYSUMMON_POLL_INTERVAL || '3', 10) * 1000;
const PENDING_DIR = path.join(SKILL_DIR, 'pending');
const INBOX_DIR = path.join(SKILL_DIR, 'inbox');
const LOG_DIR = path.join(SKILL_DIR, 'logs');

// Ensure directories exist
for (const dir of [PENDING_DIR, INBOX_DIR, LOG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, 'watcher.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stderr.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

/**
 * Simple HTTP(S) JSON request — zero dependencies
 */
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + urlPath);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = mod.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(chunks));
        } catch {
          resolve(chunks);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Load all pending requests from pending/ directory
 */
function loadPending() {
  if (!fs.existsSync(PENDING_DIR)) return [];
  return fs
    .readdirSync(PENDING_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Check if a pending request has a response and write it to inbox
 */
async function checkRequest(pending) {
  const { requestId, refCode, question, provider } = pending;

  try {
    // Check status endpoint
    const status = await apiRequest('GET', `/api/v1/help/${requestId}`);

    if (status.status === 'responded' || status.status === 'closed') {
      let response = status.response || '';

      // If no direct response field, check messages for plaintext
      if (!response) {
        try {
          const msgData = await apiRequest('GET', `/api/v1/messages/${requestId}`);
          const msgs = msgData.messages || [];
          const providerMsg = msgs.filter((m) => m.from === 'provider').pop();
          if (providerMsg) {
            response = providerMsg.plaintext || '(encrypted response received)';
          }
        } catch {
          // non-fatal
        }
      }

      if (response) {
        // Write to inbox
        const inboxEntry = {
          requestId,
          refCode,
          question,
          provider: provider || 'unknown',
          response,
          respondedAt: new Date().toISOString(),
          status: status.status,
        };

        fs.writeFileSync(
          path.join(INBOX_DIR, `${requestId}.json`),
          JSON.stringify(inboxEntry, null, 2)
        );

        // Remove from pending
        const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);
        if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);

        // ACK the event (best-effort)
        apiRequest('POST', `/api/v1/events/ack/${requestId}`, {}).catch(() => {});

        log(`Response received for ${refCode || requestId}: ${response.slice(0, 100)}...`);
        return true;
      }
    }

    // Check for expired/cancelled
    if (status.status === 'expired' || status.status === 'cancelled') {
      const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);
      if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
      log(`Request ${refCode || requestId} ${status.status} — removed from pending`);
      return true;
    }
  } catch (err) {
    // Network error, will retry next cycle
  }

  return false;
}

/**
 * Main polling loop
 */
async function poll() {
  const pending = loadPending();
  if (pending.length === 0) return;

  for (const req of pending) {
    await checkRequest(req);
  }
}

// Graceful shutdown
let running = true;
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  running = false;
});
process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  running = false;
});

// Startup
if (!API_KEY) {
  log('ERROR: HEYSUMMON_API_KEY not set. Run setup.sh first.');
  process.exit(1);
}

log(`Watcher started (pid ${process.pid})`);
log(`  Base URL: ${BASE_URL}`);
log(`  API key: ${API_KEY.slice(0, 15)}...`);
log(`  Poll interval: ${POLL_INTERVAL / 1000}s`);
log(`  Pending dir: ${PENDING_DIR}`);
log(`  Inbox dir: ${INBOX_DIR}`);

// Initial check
poll();

// Main loop
const interval = setInterval(async () => {
  if (!running) {
    clearInterval(interval);
    log('Watcher stopped.');
    process.exit(0);
  }
  await poll();
}, POLL_INTERVAL);
