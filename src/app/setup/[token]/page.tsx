import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "./copy-button";
import { buildInstallCommand, PLATFORM_META, type ClientChannel } from "@/lib/setup-command";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const record = await prisma.setupToken.findFirst({
    where: { token },
    include: {
      apiKey: { select: { id: true, key: true, name: true } },
    },
  });

  if (!record) {
    notFound();
  }

  const expired = new Date() > record.expiresAt;
  const channel = record.channel as ClientChannel;
  const meta = PLATFORM_META[channel] ?? PLATFORM_META.claudecode;
  const expertName = record.expertName ?? "your expert";

  const bound = !expired && !!(await prisma.ipEvent.findFirst({
    where: { apiKeyId: record.apiKeyId, status: "allowed" },
    select: { id: true },
  }));

  const installCmd = buildInstallCommand({
    channel,
    skillDir: meta.skillDir,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey.key,
    timeout: record.timeout,
    pollInterval: record.pollInterval,
    timeoutFallback: record.timeoutFallback,
    globalInstall: record.globalInstall,
    expertName,
    summonContext: record.summonContext,
  });

  return (
    <div className="min-h-screen bg-background text-muted-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <img src="/hey-summon.png" alt="HeySummon" className="h-8 w-8" />
            <h1 className="text-2xl font-bold text-foreground">HeySummon Setup</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Connect {meta.label} to expert{" "}
            <span className="text-foreground font-medium">&quot;{expertName}&quot;</span>
          </p>
        </div>

        {/* Expired */}
        {expired && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-6">
            <p className="text-red-400 font-semibold">This setup link has expired.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Setup links are valid for 24 hours. Ask your expert to generate a new one from the dashboard.
            </p>
          </div>
        )}

        {/* Already bound */}
        {bound && (
          <div className="rounded-lg border border-green-800/50 bg-green-950/20 p-6">
            <p className="text-green-400 font-semibold">This client is already configured.</p>
            <p className="mt-2 text-sm text-zinc-500">
              A device has been bound to this API key. If you need to reconfigure, ask your expert
              to reset the IP bindings and generate a new setup link.
            </p>
          </div>
        )}

        {/* Active setup instructions */}
        {!expired && !bound && (
          <div className="space-y-8">

            {/* OpenClaw: pre-install step */}
            {channel === "openclaw" && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground">1. Install skill</h2>
                <p className="mb-3 text-sm text-zinc-400">
                  Install the HeySummon skill if you haven&apos;t already:
                </p>
                <div className="group relative rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <pre className="overflow-x-auto font-mono text-sm text-green-400 whitespace-pre-wrap break-all pr-16">
                    npx clawhub@latest install heysummon
                  </pre>
                  <CopyButton text="npx clawhub@latest install heysummon" />
                </div>
              </section>
            )}

            {/* Main install/register command */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {channel === "openclaw" ? "2. Register expert" : "1. Install the skill"}
              </h2>
              <p className="mb-3 text-sm text-zinc-400">
                {channel === "openclaw"
                  ? "Run this from your OpenClaw agent workspace:"
                  : `Run this in your project directory:`}
              </p>
              <div className="group relative rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <pre className="overflow-x-auto font-mono text-sm text-green-400 whitespace-pre-wrap break-all pr-16">
                  {installCmd}
                </pre>
                <CopyButton text={installCmd} />
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                Credentials are pre-filled. The command downloads the skill scripts, configures
                the connection, and verifies it by calling the API. This verification step binds
                your device IP to the API key for security -- only verified devices can send
                requests. Make sure the full command runs to completion.
              </p>
            </section>

            {/* Summoning guidelines (if set) */}
            {record.summonContext && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground">
                  Summoning guidelines
                </h2>
                <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-4">
                  <p className="text-sm text-amber-200 whitespace-pre-wrap">
                    {record.summonContext}
                  </p>
                </div>
                <p className="mt-3 text-xs text-zinc-600">
                  These guidelines are embedded in the skill configuration and will be available to
                  the AI agent at runtime.
                </p>
              </section>
            )}

            {/* Verify */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {channel === "openclaw" ? "3. Verify" : "2. Verify"}
              </h2>
              <p className="text-sm text-zinc-400">
                After running the command, try asking your agent to summon {expertName}:
              </p>
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-mono text-sm text-zinc-300 italic">
                  &quot;Hey summon {expertName} to confirm this connection works&quot;
                </p>
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                The first request automatically binds your device IP. Your expert will see the
                request on their dashboard.
              </p>
            </section>

            {/* Validity */}
            <p className="text-xs text-zinc-600">
              This link is valid until{" "}
              {record.expiresAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          HeySummon -- Human-in-the-loop for AI agents
        </div>
      </div>
    </div>
  );
}
