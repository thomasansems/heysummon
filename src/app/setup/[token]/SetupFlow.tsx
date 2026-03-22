"use client";

import { useState, useEffect, useCallback } from "react";
import { Step, CodeBlock } from "@/components/dashboard/setup-step";

interface SetupFlowProps {
  keyId: string;
  apiKey: string;
  baseUrl: string;
  channel: "openclaw" | "claudecode";
  subChannel?: "telegram" | "whatsapp" | null;
  providerName: string;
  /** JWT expiry timestamp (seconds since epoch) */
  expiresAt: number;
  /** Server-side bound check — skip rendering credentials entirely */
  initialBound?: boolean;
}

type OpenClawStep = "install" | "add-provider" | "watcher" | "hook" | "connected";
type ClaudeCodeStep = "install" | "configure" | "connected";
type VerifyStatus = "idle" | "checking" | "connected" | "timeout";

const VERIFY_POLL_INTERVAL_MS = 2000;
const VERIFY_TIMEOUT_MS = 60_000;
const BOUND_CHECK_INTERVAL_MS = 60_000; // Check if bound every 60 seconds

export default function SetupFlow({
  keyId,
  apiKey,
  baseUrl,
  channel,
  subChannel,
  providerName,
  expiresAt,
  initialBound = false,
}: SetupFlowProps) {
  const isOpenClaw = channel === "openclaw";
  const totalSteps = isOpenClaw ? 5 : 3; // hook step only for openclaw

  // Check JWT expiry (24h TTL)
  const expired = Date.now() / 1000 > expiresAt;

  // Bound status — server-side initial check + client-side polling
  const [bound, setBound] = useState(initialBound);

  useEffect(() => {
    if (expired || bound) return;

    // Check immediately on mount
    const checkBound = async () => {
      try {
        const res = await fetch("/api/v1/setup/bound", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.bound) setBound(true);
        }
      } catch {
        // Network error — keep polling
      }
    };

    checkBound();
    const interval = setInterval(checkBound, BOUND_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [keyId, expired, bound]);

  // OpenClaw state
  const [openClawStep, setOpenClawStep] = useState<OpenClawStep>("install");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyElapsed, setVerifyElapsed] = useState(0);
  const [connectedIp, setConnectedIp] = useState<string | null>(null);
  const [hookExpanded, setHookExpanded] = useState(false);

  // Claude Code state
  const [claudeCodeStep, setClaudeCodeStep] = useState<ClaudeCodeStep>("install");

  // Connection verification loop
  const startVerification = useCallback(async () => {
    setVerifyStatus("checking");
    setVerifyElapsed(0);
    const start = Date.now();

    const poll = setInterval(async () => {
      const elapsed = Date.now() - start;
      setVerifyElapsed(Math.floor(elapsed / 1000));

      if (elapsed > VERIFY_TIMEOUT_MS) {
        clearInterval(poll);
        setVerifyStatus("timeout");
        return;
      }

      try {
        const res = await fetch("/api/v1/setup/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            clearInterval(poll);
            setVerifyStatus("connected");
            setConnectedIp(data.allowedIps?.[0] ?? null);
            setOpenClawStep("connected");
          }
        }
      } catch {
        // Network error — keep polling
      }
    }, VERIFY_POLL_INTERVAL_MS);
  }, [keyId]);

  // Commands
  const addProviderCmd = `cd ~/clawd && HEYSUMMON_BASE_URL="${baseUrl}" bash skills/heysummon/scripts/add-provider.sh ${apiKey} "${providerName}"`;
  const addProviderCmdReturning = `cd ~/clawd && bash skills/heysummon/scripts/add-provider.sh ${apiKey} "${providerName}"`;
  const watcherCmd = `cd ~/clawd && bash skills/heysummon/scripts/setup.sh`;
  const clawhubUrl = `https://clawhub.ai/thomasansems/heysummon`;

  const skillInstallCmd = `mkdir -p .heysummon/scripts && \\
curl -fsSL ${baseUrl}/api/v1/skill-scripts/claudecode \\
  -o .heysummon/scripts/ask.sh && \\
chmod +x .heysummon/scripts/ask.sh && \\
cat > .heysummon/.env << 'EOF'
HEYSUMMON_BASE_URL=${baseUrl}
HEYSUMMON_API_KEY=${apiKey}
HEYSUMMON_TIMEOUT=300
HEYSUMMON_POLL_INTERVAL=3
EOF`;

  const claudeMdSnippet = `## HeySummon — Human in the Loop

When you need human input, approval, or are stuck on something
that requires human judgment, use HeySummon:

\\\`\\\`\\\`bash
bash .heysummon/scripts/ask.sh "Your question here"
\\\`\\\`\\\`

Wait for the response before continuing.
The script returns the human's answer on stdout.

### Rules
- **Always wait** for the response before continuing
- **Be specific** — include relevant context in your question
- **Don't spam** — one request at a time
- If the response is \\\`PROVIDER_UNAVAILABLE\\\`, continue with your best judgment`;

  const openClawJsonSnippet = `{
  "hooks": {
    "enabled": true,
    "token": "<your HEYSUMMON_HOOKS_TOKEN from ~/.heysummon/.env>",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["agent:tertiary"],
    "allowedAgentIds": ["tertiary"],
    "defaultSessionKey": "agent:tertiary:telegram:group:<your-chat-id>"
  }
}`;

  if (bound) {
    return (
      <div className="rounded-xl border border-green-800/50 bg-green-950/30 p-8 text-center">
        <p className="text-lg font-semibold text-green-400">This client is already configured.</p>
        <p className="mt-2 text-sm text-zinc-400">
          A device has been bound to this API key. This setup page is no longer active.
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          If you need to reconfigure, ask your provider to reset the IP bindings in the dashboard and generate a new setup link.
        </p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-8 text-center">
        <p className="text-lg font-semibold text-red-400">This setup link has expired.</p>
        <p className="mt-2 text-sm text-zinc-400">
          Setup links are valid for 24 hours. Ask your provider to generate a new one from their dashboard.
        </p>
        <a
          href="/help#troubleshooting"
          className="mt-4 inline-block text-xs text-orange-400 underline hover:text-orange-300"
        >
          Troubleshooting help →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Link validity notice */}
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/40 px-3 py-1 text-xs text-zinc-400">
          <span>Valid until {new Date(expiresAt * 1000).toLocaleString()}</span>
        </div>
        <a
          href="/help"
          className="text-xs text-zinc-500 underline hover:text-zinc-400"
          target="_blank"
          rel="noopener noreferrer"
        >
          Having trouble? →
        </a>
      </div>

      {isOpenClaw && (
        <div className="space-y-5">
          {/* Step 1 — Install */}
          <Step
            number={1}
            total={totalSteps}
            title="Install the HeySummon skill"
            status={openClawStep !== "install" ? "done" : "active"}
          >
            <p className="mb-3 text-sm text-zinc-400">
              Run this in the terminal of the agent you want to connect (requires Node.js):
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
              <span className="text-xs text-zinc-500 italic">Already installed? Skip this step.</span>
            </div>
            {openClawStep === "install" && (
              <button
                onClick={() => setOpenClawStep("add-provider")}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Done — next step →
              </button>
            )}
          </Step>

          {/* Step 2 — Add provider */}
          <Step
            number={2}
            total={totalSteps}
            title={`Register "${providerName}"`}
            status={
              openClawStep === "install"
                ? "idle"
                : openClawStep === "add-provider"
                ? "active"
                : "done"
            }
          >
            <p className="mb-3 text-sm text-zinc-400">
              Run this from your OpenClaw agent workspace (usually{" "}
              <code className="rounded bg-zinc-800 px-1 font-mono text-xs">~/clawd</code>).
              The command registers this provider and saves the server URL automatically:
            </p>
            <CodeBlock>{addProviderCmd}</CodeBlock>
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400 space-y-2">
              <p>
                <span className="font-medium text-zinc-300">Already connected to another provider?</span>{" "}
                This adds a new entry to{" "}
                <code className="rounded bg-zinc-700 px-1 font-mono">~/.heysummon/providers.json</code>{" "}
                without touching existing providers.
              </p>
              <p>
                <span className="font-medium text-zinc-300">Already used HeySummon before?</span>{" "}
                The base URL is already saved — use this shorter command:
              </p>
              <CodeBlock>{addProviderCmdReturning}</CodeBlock>
            </div>
            {openClawStep === "add-provider" && (
              <button
                onClick={() => setOpenClawStep("watcher")}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Done — next step →
              </button>
            )}
          </Step>

          {/* Step 3 — Start watcher */}
          <Step
            number={3}
            total={totalSteps}
            title="Start the event watcher"
            status={
              openClawStep === "install" || openClawStep === "add-provider"
                ? "idle"
                : openClawStep === "watcher"
                ? "active"
                : "done"
            }
          >
            <p className="mb-3 text-sm text-zinc-400">
              Start the background listener so your agent receives responses:
            </p>
            <CodeBlock>{watcherCmd}</CodeBlock>
            <p className="mt-2 text-xs text-zinc-500 italic">
              Already running? Skip this — the watcher reloads providers automatically each cycle.
            </p>
            {openClawStep === "watcher" && (
              <button
                onClick={() => setOpenClawStep("hook")}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Done — next step →
              </button>
            )}
          </Step>

          {/* Step 4 — Configure openclaw.json hook */}
          <Step
            number={4}
            total={totalSteps}
            title="Configure your agent hook"
            status={
              openClawStep === "install" ||
              openClawStep === "add-provider" ||
              openClawStep === "watcher"
                ? "idle"
                : openClawStep === "hook"
                ? "active"
                : "done"
            }
          >
            {/* Auto-config note */}
            <div className="mb-3 rounded-md border border-green-800/50 bg-green-950/30 px-3 py-2">
              <p className="text-xs text-green-400">
                If <code className="text-green-300">setup.sh</code> (step 3) ran successfully, this may already be configured.
                Check <code className="text-green-300">~/.openclaw/openclaw.json</code> — if it has a{" "}
                <code className="text-green-300">hooks</code> section, you can skip to the verification checklist below.
              </p>
            </div>

            <p className="mb-3 text-sm text-zinc-400">
              For HeySummon to wake your agent when a provider responds, your{" "}
              <code className="rounded bg-zinc-800 px-1 font-mono text-xs">~/.openclaw/openclaw.json</code>{" "}
              needs a <code className="rounded bg-zinc-800 px-1 font-mono text-xs">hooks</code> section:
            </p>
            <CodeBlock>{openClawJsonSnippet}</CodeBlock>

            {/* Collapsible why/how explanation */}
            <div className="mt-3">
              <button
                onClick={() => setHookExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
              >
                <span>{hookExpanded ? "▾" : "▸"}</span>
                <span>Why do I need this? How do I fill it in?</span>
              </button>
              {hookExpanded && (
                <div className="mt-3 space-y-3 rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-xs text-zinc-400">
                  <p>
                    When your provider responds, HeySummon sends a signal to OpenClaw&apos;s gateway,
                    which then wakes the right agent in the right session. The{" "}
                    <code className="text-zinc-300">openclaw.json</code> config tells it where to
                    send that signal and which agent is allowed to receive it.
                  </p>

                  <p className="font-medium text-zinc-300">How the hook chain works:</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Platform watcher polls HeySummon for new provider responses</li>
                    <li>Response arrives → watcher sends Telegram notification</li>
                    <li>Hook handler (<code className="text-zinc-300">~/.openclaw/hooks/heysummon-responder/</code>) detects the notification</li>
                    <li>Hook calls <code className="text-zinc-300">/hooks/agent</code> on the OpenClaw gateway</li>
                    <li>Gateway wakes your agent in the configured session with the response</li>
                  </ol>

                  <p className="font-medium text-zinc-300 mt-2">Field reference:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      <code className="text-zinc-300">token</code> — find this in{" "}
                      <code className="text-zinc-300">~/.heysummon/.env</code> as{" "}
                      <code className="text-zinc-300">HEYSUMMON_HOOKS_TOKEN</code> (generated by{" "}
                      <code className="text-zinc-300">setup.sh</code>)
                    </li>
                    <li>
                      <code className="text-zinc-300">defaultSessionKey</code> — the session to
                      wake. Use{" "}
                      <code className="text-zinc-300">agent:tertiary:telegram:group:&lt;chat-id&gt;</code>{" "}
                      for Telegram groups. Find your session key in OpenClaw&apos;s session list.
                    </li>
                    <li>
                      <code className="text-zinc-300">allowedAgentIds</code> /{" "}
                      <code className="text-zinc-300">allowedSessionKeyPrefixes</code> — security
                      guard: only the listed agents can be woken. Default to{" "}
                      <code className="text-zinc-300">tertiary</code> (the async/background agent).
                    </li>
                  </ul>

                  <p className="font-medium text-zinc-300 mt-2">About providers.json:</p>
                  <p>
                    The <code className="text-zinc-300">add-provider.sh</code> script (step 2) creates{" "}
                    <code className="text-zinc-300">~/.heysummon/providers.json</code> with your API key.
                    This file is used by both the platform watcher and the MCP server to identify which providers to poll:
                  </p>
                  <CodeBlock>{`{
  "providers": [{
    "name": "${providerName}",
    "apiKey": "${apiKey.slice(0, 12)}...",
    "providerId": "...",
    "addedAt": "..."
  }]
}`}</CodeBlock>

                  <p className="font-medium text-zinc-300 mt-2">Best practice:</p>
                  <p>
                    Use the <code className="text-zinc-300">tertiary</code> agent — it&apos;s designed to
                    be woken by external events. After editing, restart the gateway:{" "}
                    <code className="rounded bg-zinc-700 px-1 text-zinc-300">pm2 restart openclaw-gateway</code>
                  </p>
                  <a
                    href="/help#openclaw-json"
                    className="block text-orange-400 underline hover:text-orange-300"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Full guide with examples →
                  </a>
                </div>
              )}
            </div>

            {/* Verification checklist */}
            <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3">
              <p className="text-xs font-medium text-zinc-300 mb-2">Before continuing, verify:</p>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">&#9634;</span>
                  <code className="text-zinc-300">~/.heysummon/providers.json</code> exists and contains your provider
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">&#9634;</span>
                  <code className="text-zinc-300">~/.heysummon/.env</code> has{" "}
                  <code className="text-zinc-300">HEYSUMMON_BASE_URL</code> and{" "}
                  <code className="text-zinc-300">HEYSUMMON_HOOKS_TOKEN</code>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">&#9634;</span>
                  <code className="text-zinc-300">~/.openclaw/openclaw.json</code> has the{" "}
                  <code className="text-zinc-300">hooks</code> section configured
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">&#9634;</span>
                  <code className="text-zinc-300">~/.openclaw/hooks/heysummon-responder/</code> directory exists
                </li>
              </ul>
            </div>

            {openClawStep === "hook" && (
              <button
                onClick={() => {
                  setOpenClawStep("connected");
                  startVerification();
                }}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Done — verify connection →
              </button>
            )}
          </Step>

          {/* Step 5 — Connected / Verification */}
          <Step
            number={5}
            total={totalSteps}
            title={verifyStatus === "connected" ? "You're connected!" : "Verifying connection…"}
            status={
              openClawStep === "connected"
                ? verifyStatus === "connected"
                  ? "done"
                  : "active"
                : "idle"
            }
          >
            {openClawStep === "connected" && (
              <>
                {verifyStatus === "idle" && (
                  <p className="text-sm text-zinc-400">Starting connection check…</p>
                )}

                {verifyStatus === "checking" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                      <p className="text-sm text-zinc-400">
                        Waiting for the watcher to connect… ({verifyElapsed}s elapsed)
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Make sure <code className="rounded bg-zinc-800 px-1 font-mono">setup.sh</code> completed
                      and the watcher process is running.
                    </p>
                  </div>
                )}

                {verifyStatus === "connected" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <span className="text-lg">✓</span>
                      <p className="text-sm font-medium">Connection verified!</p>
                    </div>
                    {connectedIp && (
                      <p className="text-xs text-zinc-500">
                        Connected from IP:{" "}
                        <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">
                          {connectedIp}
                        </code>
                      </p>
                    )}
                    <p className="text-sm text-zinc-400">
                      Your AI agent can now summon{" "}
                      <span className="font-medium text-white">&quot;{providerName}&quot;</span> when it needs
                      expert input. Just say:
                    </p>
                    <div className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-300 italic">
                      &quot;Hey summon {providerName} to help with…&quot;
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <a
                        href="/dashboard"
                        className="rounded-md bg-zinc-700 px-4 py-1.5 text-sm text-white hover:bg-zinc-600"
                      >
                        Back to dashboard →
                      </a>
                      <a
                        href="/help"
                        className="text-xs text-zinc-500 underline hover:text-zinc-400 self-center"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Help & FAQ
                      </a>
                    </div>
                  </div>
                )}

                {verifyStatus === "timeout" && (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-400 font-medium">
                      Connection not detected after 60 seconds.
                    </p>
                    <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-xs text-zinc-400 space-y-2">
                      <p className="font-medium text-zinc-300">Troubleshooting:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          Check that <code className="text-zinc-300">HEYSUMMON_BASE_URL</code> is set correctly
                          in <code className="text-zinc-300">~/.heysummon/.env</code>
                        </li>
                        <li>
                          Verify the watcher is running:{" "}
                          <code className="rounded bg-zinc-700 px-1 text-zinc-300">pm2 list</code>
                        </li>
                        <li>Check your internet connection to this server</li>
                      </ul>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={startVerification}
                        className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
                      >
                        Try again
                      </button>
                      <a
                        href="/help#troubleshooting"
                        className="text-xs text-zinc-500 underline hover:text-zinc-400 self-center"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Full troubleshooting guide →
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}

            {openClawStep !== "connected" && (
              <p className="text-sm text-zinc-500">
                Complete the previous steps to verify your connection.
              </p>
            )}
          </Step>
        </div>
      )}

      {/* Claude Code flow */}
      {channel === "claudecode" && (
        <div className="space-y-5">
          <Step
            number={1}
            total={3}
            title="Install the HeySummon skill"
            status={claudeCodeStep !== "install" ? "done" : "active"}
          >
            <p className="mb-3 text-sm text-zinc-400">
              Run this in your project directory — it downloads the skill script and saves your credentials:
            </p>
            <CodeBlock>{skillInstallCmd}</CodeBlock>
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-300">Already have HeySummon installed?</span>{" "}
              Re-running this command will update your credentials for this provider.
            </div>
            {claudeCodeStep === "install" && (
              <button
                onClick={() => setClaudeCodeStep("configure")}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Done — next step →
              </button>
            )}
          </Step>

          <Step
            number={2}
            total={3}
            title="Add to your project"
            status={
              claudeCodeStep === "install"
                ? "idle"
                : claudeCodeStep === "configure"
                ? "active"
                : "done"
            }
          >
            <p className="mb-3 text-sm text-zinc-400">
              Add this to your project&apos;s{" "}
              <code className="rounded bg-zinc-800 px-1 font-mono">CLAUDE.md</code> or{" "}
              <code className="rounded bg-zinc-800 px-1 font-mono">AGENTS.md</code>:
            </p>
            <CodeBlock>{claudeMdSnippet}</CodeBlock>
            <p className="mt-2 text-xs text-zinc-500">
              This tells Claude Code when and how to ask your provider for help.
            </p>
            {claudeCodeStep === "configure" && (
              <button
                onClick={() => setClaudeCodeStep("connected")}
                className="mt-4 rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Added — finish →
              </button>
            )}
          </Step>

          <Step
            number={3}
            total={3}
            title="You're connected!"
            status={claudeCodeStep === "connected" ? "done" : "idle"}
          >
            <p className="text-sm text-zinc-400">
              Claude Code will now use the HeySummon skill when it needs expert input from{" "}
              <span className="font-medium text-white">&quot;{providerName}&quot;</span>. It will pause, send
              your question to them, and resume automatically when they respond.
            </p>
            {claudeCodeStep === "connected" && (
              <div className="mt-3 flex gap-3">
                <a
                  href="/dashboard"
                  className="rounded-md bg-zinc-700 px-4 py-1.5 text-sm text-white hover:bg-zinc-600"
                >
                  Back to dashboard →
                </a>
                <a
                  href="/help"
                  className="text-xs text-zinc-500 underline hover:text-zinc-400 self-center"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Help & FAQ
                </a>
              </div>
            )}
          </Step>
        </div>
      )}
    </div>
  );
}
