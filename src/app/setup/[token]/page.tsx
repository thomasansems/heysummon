import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";

interface SetupPayload {
  keyId: string;
  key: string;
  baseUrl: string;
  channel: "openclaw" | "claudecode";
  subChannel?: "telegram" | "whatsapp" | null;
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

  const clawhubSlug = "thomasansems/heysummon";
  const clawhubUrl = `https://clawhub.ai/${clawhubSlug}`;

  // OpenClaw: instruction for pasting into chat
  const openClawInstruction = `Install the HeySummon skill from ClawHub:

\`\`\`
/install ${clawhubUrl}
\`\`\`

Or tell your AI agent:
> Hey, install the HeySummon skill from ${clawhubUrl} and configure it with:
> HEYSUMMON_BASE_URL=${payload.baseUrl}
> HEYSUMMON_API_KEY=${payload.key}`;

  // Claude Code: MCP snippet
  const mcpSnippet = `# Option 1 — via claude CLI (recommended)
HEYSUMMON_BASE_URL="${payload.baseUrl}" \\
HEYSUMMON_API_KEY="${payload.key}" \\
claude mcp add heysummon \\
  --env HEYSUMMON_BASE_URL="${payload.baseUrl}" \\
  --env HEYSUMMON_API_KEY="${payload.key}" \\
  -- npx @heysummon/claude-code-mcp

# Option 2 — manual ~/.claude/settings.json
{
  "mcpServers": {
    "heysummon": {
      "command": "npx",
      "args": ["@heysummon/claude-code-mcp"],
      "env": {
        "HEYSUMMON_BASE_URL": "${payload.baseUrl}",
        "HEYSUMMON_API_KEY": "${payload.key}"
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
            You&apos;ve been invited to connect to a HeySummon provider. Follow the steps below to get started.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-700 bg-amber-950/40 px-3 py-1 text-xs text-amber-400">
            <span>⏱</span>
            <span>This link expires in 10 minutes — set it up now</span>
          </div>
        </div>

        {isOpenClaw && (
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">1</span>
                <h2 className="font-semibold text-white">Install the HeySummon skill</h2>
              </div>
              <p className="mb-3 text-sm text-zinc-400">
                Open your OpenClaw chat ({payload.subChannel === "whatsapp" ? "WhatsApp" : "Telegram"}) and run:
              </p>
              <div className="rounded-lg bg-black p-3">
                <code className="font-mono text-sm text-green-400">
                  /skill install {clawhubUrl}
                </code>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Or visit <a href={clawhubUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">{clawhubUrl}</a> to install manually.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">2</span>
                <h2 className="font-semibold text-white">Configure credentials</h2>
              </div>
              <p className="mb-3 text-sm text-zinc-400">
                After installing, configure the skill with these credentials. Paste this into your chat:
              </p>
              <div className="rounded-lg bg-black p-3">
                <pre className="overflow-x-auto font-mono text-xs text-green-400">{openClawInstruction}</pre>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">3</span>
                <h2 className="font-semibold text-white">Start using HeySummon</h2>
              </div>
              <p className="text-sm text-zinc-400">
                Once configured, your AI agent can request expert help by saying{" "}
                <em>&quot;Hey summon help with...&quot;</em> — the request routes directly to your provider.
              </p>
            </div>
          </div>
        )}

        {isClaudeCode && (
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">1</span>
                <h2 className="font-semibold text-white">Add the HeySummon MCP server</h2>
              </div>
              <p className="mb-3 text-sm text-zinc-400">
                Run one of these commands in your terminal. Your credentials are pre-filled.
              </p>
              <div className="rounded-lg bg-black p-3">
                <pre className="overflow-x-auto font-mono text-xs text-green-400">{mcpSnippet}</pre>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">2</span>
                <h2 className="font-semibold text-white">Verify installation</h2>
              </div>
              <p className="mb-3 text-sm text-zinc-400">Check that the MCP server is registered:</p>
              <div className="rounded-lg bg-black p-3">
                <code className="font-mono text-sm text-green-400">claude mcp list</code>
              </div>
              <p className="mt-2 text-xs text-zinc-500">You should see <code className="rounded bg-zinc-800 px-1 text-zinc-300">heysummon</code> in the list.</p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">3</span>
                <h2 className="font-semibold text-white">Use it in Claude Code</h2>
              </div>
              <p className="text-sm text-zinc-400">
                Claude Code can now call <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">heysummon</code> when it needs expert input. It will pause, send your question to the provider, and resume when they respond.
              </p>
            </div>

            {/* ClawHub link */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-2 font-semibold text-white">📦 Also available on ClawHub</h2>
              <p className="mb-3 text-sm text-zinc-400">
                Install the full HeySummon skill (for OpenClaw agents) from ClawHub:
              </p>
              <a
                href={clawhubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-950/70"
              >
                View on ClawHub →
              </a>
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-xs text-zinc-600">
          HeySummon — Human-in-the-loop for AI agents ·{" "}
          <a href="https://heysummon.ai" className="text-zinc-500 underline">heysummon.ai</a>
        </div>
      </div>
    </div>
  );
}
