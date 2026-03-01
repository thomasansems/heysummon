#!/usr/bin/env node
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

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from skill root
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
}

const BASE_URL = process.env.HEYSUMMON_BASE_URL;
const API_KEY = process.env.HEYSUMMON_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error("ERROR: Set HEYSUMMON_BASE_URL and HEYSUMMON_API_KEY in skills/claudecode/.env");
  process.exit(1);
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

    // Build message payload
    const messages = [
      {
        role: "user",
        content: context ? `${question}\n\n---\n\n${context}` : question,
      },
    ];

    // Submit help request
    let requestId;
    let refCode;
    try {
      const res = await fetch(`${BASE_URL}/api/v1/help`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          question,
          messages,
          ...(provider && { providerName: provider }),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return {
          content: [{ type: "text", text: `❌ HeySummon error: ${res.status} — ${err}` }],
          isError: true,
        };
      }

      const data = await res.json();
      requestId = data.id;
      refCode = data.refCode;
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ Failed to submit request: ${err.message}` }],
        isError: true,
      };
    }

    // Poll for response via SSE stream
    const response = await waitForResponse(requestId, timeoutMs);

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
 * Poll the requests endpoint until a response arrives or timeout.
 */
async function waitForResponse(requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 3000; // poll every 3s

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/requests/${requestId}`, {
        headers: { "x-api-key": API_KEY },
      });

      if (res.ok) {
        const data = await res.json();
        const status = data.request?.status;

        if (status === "responded" || status === "closed") {
          // Extract provider response from messages
          const messages = data.request?.messages ?? [];
          const providerMsg = [...messages].reverse().find(
            (m) => m.role === "provider" || m.from === "provider"
          );
          if (providerMsg) {
            return providerMsg.content ?? providerMsg.plaintext ?? providerMsg.text;
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

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
