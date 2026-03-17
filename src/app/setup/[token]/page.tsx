import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";

interface SetupPayload {
  keyId: string;
  key: string;
  baseUrl: string;
  channel: "openclaw" | "claudecode";
  subChannel?: "telegram" | "whatsapp" | null;
  providerName?: string | null;
}

async function verifyToken(token: string): Promise<SetupPayload | null> {
  try {
    const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "heysummon-setup-secret";
    const payload = jwt.verify(token, secret) as SetupPayload & { exp: number };
    return payload;
  } catch {
    return null;
  }
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="group relative rounded-lg bg-zinc-950 border border-zinc-800 p-4">
      <pre className="overflow-x-auto font-mono text-sm text-green-400 whitespace-pre-wrap break-all">{children}</pre>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
          {number}
        </span>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default async function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await verifyToken(token);

  if (!payload) {
    notFound();
  }

  const isOpenClaw = payload.channel === "openclaw";
  const isClaudeCode = payload.channel === "claudecode";
  const providerName = payload.providerName ?? "your provider";
  const baseUrl = payload.baseUrl;
  const key = payload.key;
  const clawhubUrl = `https://clawhub.ai/thomasansems/heysummon`;

  // Single command that handles first-time setup + multi-provider
  const addProviderCmd = `bash skills/heysummon/scripts/add-provider.sh ${key} "${providerName}" "${baseUrl}"`;
  const watcherCmd = `bash skills/heysummon/scripts/setup.sh`;

  // Claude Code MCP
  const mcpCmd = `claude mcp add heysummon \\
  --env HEYSUMMON_BASE_URL="${baseUrl}" \\
  --env HEYSUMMON_API_KEY="${key}" \\
  -- npx @heysummon/mcp`;

  const mcpJson = `{
  "mcpServers": {
    "heysummon": {
      "command": "npx",
      "args": ["@heysummon/mcp"],
      "env": {
        "HEYSUMMON_BASE_URL": "${baseUrl}",
        "HEYSUMMON_API_KEY": "${key}"
      }
    }
  }
}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-3xl">🦞</span>
            <h1 className="text-2xl font-bold text-white">HeySummon Setup</h1>
          </div>
          <p className="text-sm text-zinc-400">
            You&apos;ve been invited to connect to{" "}
            <span className="font-medium text-white">&quot;{providerName}&quot;</span>.
            Follow the steps below — your credentials are already pre-filled.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1 text-xs text-amber-400">
            <span>⏱</span>
            <span>This link expires in 10 minutes — act now</span>
          </div>
        </div>

        {isOpenClaw && (
          <div className="space-y-5">

            {/* Step 1 — Install (skip if already installed) */}
            <Step number={1} title="Install the HeySummon skill">
              <p className="mb-3 text-sm text-zinc-400">
                Run this in your terminal (requires Node.js):
              </p>
              <CodeBlock>{`npx clawhub@latest install heysummon`}</CodeBlock>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={clawhubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-400 underline hover:text-orange-300"
                >
                  Browse on ClawHub →
                </a>
                <span className="text-xs text-zinc-600">·</span>
                <span className="text-xs text-zinc-500 italic">
                  Already installed? Skip to step 2.
                </span>
              </div>
            </Step>

            {/* Step 2 — Add provider (THE main step, handles everything) */}
            <Step number={2} title={`Add "${providerName}" as a provider`}>
              <p className="mb-3 text-sm text-zinc-400">
                This registers the provider so your agent can route requests to them.
                Run from your OpenClaw workspace directory:
              </p>
              <CodeBlock>{addProviderCmd}</CodeBlock>
              <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400 space-y-1">
                <p>
                  <span className="text-zinc-300 font-medium">Already have HeySummon installed?</span>{" "}
                  Just run this command — it adds this provider to your existing setup without touching your other providers.
                </p>
                <p>
                  <span className="text-zinc-300 font-medium">Multiple providers?</span>{" "}
                  Run this once per setup link — each provider gets their own entry in{" "}
                  <code className="rounded bg-zinc-700 px-1 font-mono">providers.json</code>.
                </p>
              </div>
            </Step>

            {/* Step 3 — Start watcher (skip if already running) */}
            <Step number={3} title="Start the event watcher">
              <p className="mb-3 text-sm text-zinc-400">
                Start the background listener so your agent receives responses from{" "}
                {payload.subChannel === "whatsapp" ? "WhatsApp" : "Telegram"}:
              </p>
              <CodeBlock>{watcherCmd}</CodeBlock>
              <p className="mt-2 text-xs text-zinc-500 italic">
                Already running? Skip this — your watcher picks up new providers automatically.
              </p>
            </Step>

            {/* Step 4 — Done */}
            <Step number={4} title="You're connected!">
              <p className="text-sm text-zinc-400">
                Your AI agent can now summon{" "}
                <span className="font-medium text-white">&quot;{providerName}&quot;</span> when it needs expert input.
                Just say:
              </p>
              <div className="mt-3 rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-300 italic">
                &quot;Hey summon {providerName} to help with...&quot;
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Or simply: &quot;Hey summon, help with...&quot; — routes to your default provider.
              </p>
            </Step>

          </div>
        )}

        {isClaudeCode && (
          <div className="space-y-5">

            {/* Step 1 — Add MCP */}
            <Step number={1} title="Add the HeySummon MCP server">
              <p className="mb-3 text-sm text-zinc-400">
                Run this in your terminal — credentials are pre-filled:
              </p>
              <CodeBlock>{mcpCmd}</CodeBlock>
              <p className="mt-3 text-xs text-zinc-500">
                Or add manually to{" "}
                <code className="rounded bg-zinc-800 px-1 font-mono">~/.claude/settings.json</code>:
              </p>
              <div className="mt-2">
                <CodeBlock>{mcpJson}</CodeBlock>
              </div>
              <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400">
                <span className="text-zinc-300 font-medium">Already have HeySummon configured?</span>{" "}
                Running the command again will update the environment variables for this provider.
                Each Claude Code session gets one MCP connection — credentials are per-session.
              </div>
            </Step>

            {/* Step 2 — Verify */}
            <Step number={2} title="Verify installation">
              <p className="mb-3 text-sm text-zinc-400">
                Check that the MCP server is registered:
              </p>
              <CodeBlock>{`claude mcp list`}</CodeBlock>
              <p className="mt-2 text-xs text-zinc-500">
                You should see{" "}
                <code className="rounded bg-zinc-800 px-1 font-mono">heysummon</code> in the list.
                Package:{" "}
                <a href="https://www.npmjs.com/package/@heysummon/mcp" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">
                  @heysummon/mcp
                </a>{" "}
                on npm.
              </p>
            </Step>

            {/* Step 3 — Done */}
            <Step number={3} title="You're connected!">
              <p className="text-sm text-zinc-400">
                Claude Code can now call{" "}
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">heysummon</code>{" "}
                when it needs expert input from{" "}
                <span className="font-medium text-white">&quot;{providerName}&quot;</span>.
                It will pause, send your question to them, and resume automatically when they respond.
              </p>
            </Step>

          </div>
        )}

        <div className="mt-10 text-center text-xs text-zinc-600">
          HeySummon — Human-in-the-loop for AI agents ·{" "}
          <a href="https://heysummon.app" className="text-zinc-500 underline hover:text-zinc-400">
            heysummon.app
          </a>
        </div>

      </div>
    </div>
  );
}
