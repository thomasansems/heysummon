"use client";

import { useEffect } from "react";

// Extend Navigator for WebMCP API
declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (params: Record<string, unknown>, agent?: unknown) => unknown;
  }

  interface ModelContext {
    provideContext: (ctx: { tools: ModelContextTool[] }) => void;
    registerTool: (tool: ModelContextTool) => void;
    unregisterTool: (name: string) => void;
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}

const HEYSUMMON_TOOLS: ModelContextTool[] = [
  {
    name: "request-human-help",
    description:
      "Request help from a human expert via HeySummon. Send your recent conversation messages and a specific question. A human provider will review the context and respond with an answer. Requires a valid HeySummon API key.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description:
            "Your HeySummon API key (starts with hs_). Get one from a provider or create your own at cloud.heysummon.ai/auth/login.",
        },
        messages: {
          type: "array",
          description:
            "Array of recent conversation messages for context. Each message has a role (user/assistant) and content string. Send the last 5-10 messages.",
          items: {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["user", "assistant"],
                description: "Who sent the message",
              },
              content: {
                type: "string",
                description: "The message content",
              },
            },
            required: ["role", "content"],
          },
        },
        question: {
          type: "string",
          description:
            "A specific question for the human expert. Be clear about what you need help with.",
        },
      },
      required: ["apiKey", "messages", "question"],
    },
    execute: async (params) => {
      const { apiKey, messages, question } = params as {
        apiKey: string;
        messages: { role: string; content: string }[];
        question: string;
      };

      const res = await fetch("/api/v1/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, messages, question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create help request");
      }

      return await res.json();
    },
  },
  {
    name: "check-help-request",
    description:
      "Check the status of a previously submitted help request. Returns the current status (pending, responded, expired) and the human expert's response if available.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "The request ID returned from request-human-help",
        },
      },
      required: ["requestId"],
    },
    execute: async (params) => {
      const { requestId } = params as { requestId: string };

      const res = await fetch(`/api/v1/help/${requestId}`);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to check request status");
      }

      return await res.json();
    },
  },
  {
    name: "join-waitlist",
    description:
      "Join the HeySummon waitlist with an email address. You'll receive a verification email to confirm your signup.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address to join the waitlist",
        },
      },
      required: ["email"],
    },
    execute: async (params) => {
      const { email } = params as { email: string };

      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      return await res.json();
    },
  },
];

export function WebMCPProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mc = navigator.modelContext;
    if (!mc) {
      // WebMCP not supported — silently skip
      return;
    }

    try {
      mc.provideContext({ tools: HEYSUMMON_TOOLS });
      console.log("[WebMCP] Registered HeySummon tools:", HEYSUMMON_TOOLS.map((t) => t.name));
    } catch (e) {
      console.warn("[WebMCP] Failed to register tools:", e);
    }
  }, []);

  return null;
}
