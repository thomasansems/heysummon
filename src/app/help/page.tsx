import Link from "next/link";

export const metadata = {
  title: "HeySummon Help",
  description: "Client setup guide and troubleshooting for HeySummon",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Qa({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-medium text-foreground">{q}</p>
      <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="inline rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="mt-2 mb-3 rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground">HeySummon Help</h1>
          <p className="mt-2 text-muted-foreground">
            Your guide to setting up and troubleshooting the HeySummon client.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-10 rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">On this page</p>
          <ul className="space-y-1.5 text-sm">
            <li><a href="#getting-started" className="text-primary hover:underline">Getting started</a></li>
            <li><a href="#openclaw" className="text-primary hover:underline">OpenClaw setup</a></li>
            <li><a href="#claudecode" className="text-primary hover:underline">Claude Code (MCP) setup</a></li>
            <li><a href="#openclaw-json" className="text-primary hover:underline">Configuring openclaw.json</a></li>
            <li><a href="#troubleshooting" className="text-primary hover:underline">Troubleshooting FAQ</a></li>
            <li><a href="#contact" className="text-primary hover:underline">Contact your provider</a></li>
          </ul>
        </nav>

        <div className="space-y-12">
          <Section id="getting-started" title="Getting started">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              HeySummon is a Human-in-the-Loop service. Your AI agent (OpenClaw or Claude Code) can
              send requests to a human expert, and the expert responds directly in your agent&apos;s
              session. Setup takes about 5 minutes.
            </p>
            <p className="text-sm text-muted-foreground">
              You received a setup link from your provider. Open that link to start the guided
              installation. If the link has expired (links are valid for 10 minutes), ask your provider
              to generate a new one from their dashboard.
            </p>
          </Section>

          <Section id="openclaw" title="OpenClaw setup">
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              The setup link walks you through four steps automatically. Here&apos;s what each step does:
            </p>
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-foreground">Install the skill</strong> — Clones the HeySummon
                skill into your OpenClaw skills directory.
              </li>
              <li>
                <strong className="text-foreground">Register your provider</strong> — Runs{" "}
                <Code>add-provider.sh</Code> with your API key, saving it to{" "}
                <Code>~/.heysummon/providers.json</Code>.
              </li>
              <li>
                <strong className="text-foreground">Start the watcher</strong> — Launches{" "}
                <Code>platform-watcher.sh</Code> via pm2. This process polls HeySummon every 5 seconds
                and wakes your agent when a response arrives.
              </li>
              <li>
                <strong className="text-foreground">Configure the response hook</strong> — Updates{" "}
                <Code>~/.openclaw/openclaw.json</Code> so HeySummon knows which agent to wake.{" "}
                <a href="#openclaw-json" className="text-primary hover:underline">See the full guide below.</a>
              </li>
            </ol>
          </Section>

          <Section id="claudecode" title="Claude Code (MCP) setup">
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Claude Code uses the <Code>@heysummon/mcp</Code> package as an MCP server.
              The setup link guides you through:
            </p>
            <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-foreground">Add the MCP server</strong> — Runs{" "}
                <Code>claude mcp add heysummon</Code> which registers the server globally in Claude Code.
              </li>
              <li>
                <strong className="text-foreground">Verify the connection</strong> — The setup page
                confirms your key is configured correctly and Claude Code can reach HeySummon.
              </li>
            </ol>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              Once set up, you can call{" "}
              <Code>heysummon(question=&quot;your question&quot;)</Code> inside Claude Code to request
              expert help. Claude will wait up to 5 minutes for a response.
            </p>
          </Section>

          <Section id="openclaw-json" title="Configuring openclaw.json (OpenClaw hook)">
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              When your provider responds, HeySummon needs to wake your agent. It does this by
              calling the OpenClaw gateway hook. You tell HeySummon which agent to wake via{" "}
              <Code>~/.openclaw/openclaw.json</Code>.
            </p>

            <h3 className="font-semibold text-foreground mt-6 mb-2">Why you need this</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              HeySummon can&apos;t directly resume your Claude agent — it sends a signal to
              OpenClaw&apos;s gateway, which then wakes the right agent in the right session. The{" "}
              <Code>hooks</Code> section of <Code>openclaw.json</Code> controls this.
            </p>

            <h3 className="font-semibold text-foreground mt-6 mb-2">Configuration</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Open <Code>~/.openclaw/openclaw.json</Code> and add or update the{" "}
              <Code>hooks</Code> section:
            </p>
            <Pre>{`{
  "hooks": {
    "enabled": true,
    "token": "<your HEYSUMMON_HOOKS_TOKEN from ~/.heysummon/.env>",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["agent:tertiary"],
    "allowedAgentIds": ["tertiary"],
    "defaultSessionKey": "agent:tertiary:telegram:group:<your-chat-id>"
  }
}`}</Pre>

            <h3 className="font-semibold text-foreground mt-6 mb-2">Field reference</h3>
            <div className="space-y-2 text-sm">
              {[
                { field: "enabled", desc: "Must be true to activate the hook system." },
                { field: "token", desc: "Security token from ~/.heysummon/.env (HEYSUMMON_HOOKS_TOKEN). Generated by setup.sh. Only HeySummon can send hooks with this token." },
                { field: "defaultSessionKey", desc: "The session HeySummon wakes. Format: agent:<agentId>:<channel>:<type>:<id>. Copy it from OpenClaw's session list." },
                { field: "allowedAgentIds", desc: "Only these agent IDs can be woken. Use the tertiary agent (designed for async wakeups)." },
                { field: "allowedSessionKeyPrefixes", desc: "Only session keys starting with this prefix are accepted — prevents unauthorized session access." },
              ].map(({ field, desc }) => (
                <div key={field} className="flex gap-3">
                  <Code>{field}</Code>
                  <span className="text-muted-foreground leading-relaxed">{desc}</span>
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-foreground mt-6 mb-2">Best practices</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
              <li>Use the <strong className="text-foreground">tertiary agent</strong> — it&apos;s designed for being woken by external events.</li>
              <li>Your <Code>defaultSessionKey</Code> should match your active Telegram group or DM session.</li>
              <li>After editing, restart OpenClaw gateway: <Code>pm2 restart openclaw-gateway</Code></li>
              <li>Test it by running setup.sh again — it will verify the hook reaches the gateway.</li>
            </ul>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting FAQ">
            <div className="space-y-6">
              <Qa q="My setup link expired.">
                Links are valid for 10 minutes. Ask your provider to generate a new one: Dashboard →
                Clients → [your key] → Generate Setup Link.
              </Qa>

              <Qa q="The watcher started but I get no notifications.">
                Check <Code>HEYSUMMON_BASE_URL</Code> in <Code>~/.heysummon/.env</Code>. Make sure the URL
                is reachable from your machine. Try submitting a test request and running{" "}
                <Code>pm2 logs heysummon-watcher</Code> to see what the watcher is doing.
              </Qa>

              <Qa q="I see 'IP not allowed' errors.">
                Your IP address needs to be approved. Contact your provider and ask them to approve
                your IP in Dashboard → Clients → [your key] → IP Events. This happens the first time
                you use a key from a new location.
              </Qa>

              <Qa q="How do I check if the watcher is running?">
                Run <Code>pm2 list</Code> and look for <Code>heysummon-watcher</Code> with status{" "}
                <Code>online</Code>. Or: <Code>ps aux | grep platform-watcher</Code>
              </Qa>

              <Qa q="The watcher crashes immediately.">
                Check <Code>~/.heysummon/.env</Code> has <Code>HEYSUMMON_BASE_URL</Code> set and
                that you have at least one provider registered. Run{" "}
                <Code>bash scripts/platform-watcher.sh</Code> manually to see the error output.
              </Qa>

              <Qa q="I added a new provider but the watcher doesn't pick them up.">
                The watcher reloads <Code>~/.heysummon/providers.json</Code> each polling cycle — no
                restart needed. Wait up to 10 seconds for the next poll.
              </Qa>

              <Qa q="claude mcp list doesn't show heysummon.">
                The <Code>claude mcp add</Code> command must be run in a terminal, not inside Claude
                Code itself. After adding, fully restart Claude Code. Check with{" "}
                <Code>claude mcp list</Code> in a fresh terminal.
              </Qa>

              <Qa q="The MCP tool times out.">
                Default timeout is 300 seconds (5 minutes). Your provider may be in their quiet hours
                or unavailable. Check with your provider. You can also call{" "}
                <Code>heysummon_status(requestId=&quot;...&quot;)</Code> to check the request status later.
              </Qa>

              <Qa q="My agent wakes up but with the wrong session.">
                Update <Code>defaultSessionKey</Code> in <Code>openclaw.json</Code> to match the
                correct session. See the{" "}
                <a href="#openclaw-json" className="text-primary hover:underline">openclaw.json guide</a>{" "}
                above. Restart the OpenClaw gateway after editing.
              </Qa>

              <Qa q="I'm not sure which API key to use.">
                Each provider you work with has their own client API key. The setup link from your
                provider already contains the correct key — you don&apos;t need to find or copy it
                manually. Just follow the setup link.
              </Qa>
            </div>
          </Section>

          <Section id="contact" title="Contact your provider">
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you&apos;re still stuck after checking this guide, reach out to your provider directly.
              They can see your connection status, IP events, and request history from their dashboard,
              which makes it much easier to diagnose issues.
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              When contacting your provider, mention:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your client name or the last 4 characters of your API key</li>
              <li>Any error messages you see in the terminal</li>
              <li>Your operating system and how you run OpenClaw</li>
            </ul>
          </Section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">heysummon.ai</Link>
          {" · "}
          <a href="mailto:support@heysummon.ai" className="hover:underline">support@heysummon.ai</a>
        </div>
      </div>
    </div>
  );
}
