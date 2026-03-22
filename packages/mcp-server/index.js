#!/usr/bin/env node
/* global process, console, fetch, setTimeout */
/**
 * HeySummon MCP Server for Claude Code
 * Exposes a `heysummon` tool that lets Claude Code request human expert help inline.
 *
 * Setup: claude mcp add heysummon node /path/to/mcp-server/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateKeyPairSync } from "crypto";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from ~/.heysummon/.env (canonical location for consumer configuration)
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const envContent = readFileSync(path, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(homedir(), ".heysummon", ".env"));
loadEnvFile(join(__dirname, "..", ".env")); // legacy fallback for skill-dir setups

// Resolve API key: prefer providers.json (multi-provider), fall back to env var
function loadApiKey(providerName) {
  const providersPath =
    process.env.HEYSUMMON_PROVIDERS_FILE ?? join(homedir(), ".heysummon", "providers.json");
  if (existsSync(providersPath)) {
    try {
      const data = JSON.parse(readFileSync(providersPath, "utf-8"));
      const providers = data.providers ?? [];
      if (providers.length > 0) {
        if (providerName) {
          const lower = providerName.toLowerCase();
          const match = providers.find((p) => p.nameLower === lower || p.name.toLowerCase() === lower);
          if (match) return match.apiKey;
        }
        return providers[0].apiKey; // default: first registered provider
      }
    } catch {
      // fall through to env var
    }
  }
  return process.env.HEYSUMMON_API_KEY ?? null;
}

const BASE_URL = process.env.HEYSUMMON_BASE_URL;

if (!BASE_URL) {
  console.error(
    "ERROR: HEYSUMMON_BASE_URL is not set.\n" +
    "Add it to ~/.heysummon/.env or run: bash scripts/add-provider.sh <key>"
  );
  process.exit(1);
}

// Verify at least one API key is available
if (!loadApiKey()) {
  console.error(
    "ERROR: No API key found.\n" +
    "Register a provider first: bash scripts/add-provider.sh <key>\n" +
    "Or set HEYSUMMON_API_KEY in ~/.heysummon/.env"
  );
  process.exit(1);
}

/**
 * Generate Ed25519 (signing) + X25519 (encryption) key pairs.
 * Matches the algorithm expected by the HeySummon platform.
 */
function generateSessionKeys() {
  const sign = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const enc = generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    signPublicKey: sign.publicKey,
    encryptPublicKey: enc.publicKey,
  };
}

const server = new McpServer({
  name: "heysummon",
  version: "0.1.0",
});

server.tool(
  "heysummon",
  "Request help from a human expert via HeySummon. Use when genuinely stuck on a problem that requires human judgment or expertise.",
  {
    question: z.string().describe("Your specific question for the human expert"),
    context: z.string().optional().describe("Relevant code, errors, or background context"),
    provider: z.string().optional().describe("Provider name to route to a specific expert (optional)"),
    timeout: z.number().optional().default(300).describe("Max seconds to wait for a response (default: 300)"),
  },
  async ({ question, context, provider, timeout }) => {
    const timeoutMs = (timeout ?? 300) * 1000;
    const apiKey = loadApiKey(provider);
    if (!apiKey) {
      return { content: [{ type: "text", text: `❌ No API key for provider "${provider}". Register via add-provider.sh.` }], isError: true };
    }

    // Generate session key pair for E2E encryption (Ed25519 sign + X25519 encrypt)
    const { signPublicKey, encryptPublicKey } = generateSessionKeys();

    // Build message payload
    const messages = [
      {
        role: "user",
        content: context ? `${question}\n\n---\n\n${context}` : question,
      },
    ];

    // Submit help request (up to 3 attempts with 1s backoff)
    let requestId;
    let refCode;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/help`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            apiKey,
            signPublicKey,
            encryptPublicKey,
            question,
            messages,
            ...(provider && { providerName: provider }),
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          // 4xx errors are not retryable
          if (res.status >= 400 && res.status < 500) {
            return { content: [{ type: "text", text: `❌ HeySummon error: ${res.status} — ${err}` }], isError: true };
          }
          lastErr = new Error(`${res.status}: ${err}`);
        } else {
          const data = await res.json();
          requestId = data.requestId || data.id;
          refCode = data.refCode;
          break;
        }
      } catch (err) {
        lastErr = err;
      }

      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    if (!requestId) {
      return {
        content: [{ type: "text", text: `❌ Failed to submit request after 3 attempts: ${lastErr?.message}` }],
        isError: true,
      };
    }

    // Poll for response
    const response = await waitForResponse(requestId, apiKey, timeoutMs);

    if (!response) {
      return {
        content: [{
          type: "text",
          text: `⏳ No response received within ${timeout}s (ref: ${refCode}).\n\nThe expert has been notified. You can check back later or continue with what you know.`,
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: `💬 Expert response (${refCode}):\n\n${response}`,
      }],
    };
  }
);

/**
 * Poll /api/v1/help/[id] until responded/closed, then fetch message from /api/v1/messages/[id].
 */
async function waitForResponse(requestId, apiKey, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 3000; // poll every 3s

  while (Date.now() < deadline) {
    try {
      const statusRes = await fetch(`${BASE_URL}/api/v1/help/${requestId}`, {
        headers: { "x-api-key": apiKey },
      });

      if (statusRes.ok) {
        const data = await statusRes.json();
        const status = data.request?.status;

        if (status === "responded" || status === "closed") {
          // Fetch actual messages
          const msgsRes = await fetch(`${BASE_URL}/api/v1/messages/${requestId}`, {
            headers: { "x-api-key": apiKey },
          });
          if (msgsRes.ok) {
            const msgsData = await msgsRes.json();
            const msgs = msgsData.messages ?? [];
            const providerMsg = [...msgs].reverse().find((m) => m.from === "provider");
            if (providerMsg) {
              // Messages are encrypted — return ciphertext note if iv isn't "plaintext"
              if (providerMsg.iv === "plaintext") {
                return Buffer.from(providerMsg.ciphertext, "base64").toString();
              }
              return "(encrypted message — decryption requires the consumer client)";
            }
          }
        }
      }
    } catch {
      // ignore transient errors
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return null;
}

server.tool(
  "heysummon_providers",
  "List available HeySummon providers (human experts) you can route help requests to.",
  {},
  async () => {
    const apiKey = loadApiKey();
    try {
      const res = await fetch(`${BASE_URL}/api/v1/providers`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        return { content: [{ type: "text", text: `❌ Could not fetch providers: ${res.status}` }], isError: true };
      }
      const data = await res.json();
      const providers = data.providers ?? [];
      if (providers.length === 0) {
        return { content: [{ type: "text", text: "No providers available." }] };
      }
      const list = providers.map((p) => `- **${p.name}**${p.description ? `: ${p.description}` : ""}`).join("\n");
      return { content: [{ type: "text", text: `Available providers:\n\n${list}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "heysummon_status",
  "Check the status of an existing HeySummon help request.",
  {
    requestId: z.string().describe("The request ID returned by the heysummon tool"),
  },
  async ({ requestId }) => {
    const apiKey = loadApiKey();
    try {
      const statusRes = await fetch(`${BASE_URL}/api/v1/help/${requestId}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!statusRes.ok) {
        return { content: [{ type: "text", text: `❌ Request not found: ${statusRes.status}` }], isError: true };
      }
      const data = await statusRes.json();
      const status = data.request?.status ?? "unknown";

      let text = `Status: **${status}**`;

      if (status === "responded" || status === "closed") {
        const msgsRes = await fetch(`${BASE_URL}/api/v1/messages/${requestId}`, {
          headers: { "x-api-key": apiKey },
        });
        if (msgsRes.ok) {
          const msgsData = await msgsRes.json();
          const msgs = msgsData.messages ?? [];
          const lastMsg = [...msgs].reverse().find((m) => m.from === "provider");
          if (lastMsg && lastMsg.iv === "plaintext") {
            text += `\n\nLatest response:\n${Buffer.from(lastMsg.ciphertext, "base64").toString()}`;
          } else if (lastMsg) {
            text += "\n\n(Response is encrypted — use the consumer client to decrypt)";
          }
        }
      }

      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
    }
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
