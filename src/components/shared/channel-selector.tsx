"use client";

import { AlertTriangle } from "lucide-react";

export type ProviderChannelType = "openclaw" | "telegram" | "slack";

interface ChannelSelectorProps {
  selected: ProviderChannelType | null;
  onSelect: (channel: ProviderChannelType) => void;
  botToken?: string;
  onBotTokenChange?: (token: string) => void;
  slackBotToken?: string;
  onSlackBotTokenChange?: (token: string) => void;
  slackSigningSecret?: string;
  onSlackSigningSecretChange?: (secret: string) => void;
  slackChannelId?: string;
  onSlackChannelIdChange?: (id: string) => void;
  tunnelActive?: boolean | null;
}

export function ChannelSelector({
  selected,
  onSelect,
  botToken,
  onBotTokenChange,
  slackBotToken,
  onSlackBotTokenChange,
  slackSigningSecret,
  onSlackSigningSecretChange,
  slackChannelId,
  onSlackChannelIdChange,
  tunnelActive,
}: ChannelSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        Notification channel <span className="text-red-400">*</span>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onSelect("openclaw")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            selected === "openclaw"
              ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <img
              src="/icons/openclaw.svg"
              alt="OpenClaw"
              className="h-7 w-7 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-sm font-medium text-foreground">OpenClaw</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Receive in your existing OpenClaw chat
          </p>
        </button>
        <button
          type="button"
          onClick={() => onSelect("telegram")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            selected === "telegram"
              ? "border-blue-500 bg-blue-950/30"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <img
              src="/icons/telegram.svg"
              alt="Telegram"
              className="h-7 w-7 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-sm font-medium text-foreground">Telegram Bot</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dedicated bot — forward requests to a chat
          </p>
        </button>
        <button
          type="button"
          onClick={() => onSelect("slack")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            selected === "slack"
              ? "border-purple-500 bg-purple-950/30"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <img
              src="/icons/slack.svg"
              alt="Slack"
              className="h-7 w-7 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-sm font-medium text-foreground">Slack</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Receive requests in a Slack channel
          </p>
        </button>
      </div>

      {selected === "telegram" && onBotTokenChange && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Bot token <span className="text-red-400">*</span>
          </label>
          <input
            value={botToken ?? ""}
            onChange={(e) => onBotTokenChange(e.target.value)}
            placeholder="123456789:ABCdef..."
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Get a token from{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              @BotFather
            </a>{" "}
            on Telegram.
          </p>
          {tunnelActive === false && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Public access required.</strong> Enable a tunnel first so
                webhooks can reach your server.
              </span>
            </div>
          )}
          {tunnelActive === true && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
              <span>Public access is active — webhooks will be registered automatically.</span>
            </div>
          )}
        </div>
      )}

      {selected === "slack" && onSlackBotTokenChange && onSlackSigningSecretChange && onSlackChannelIdChange && (
        <div className="space-y-3">
          <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20 p-3 text-xs text-purple-700 dark:text-purple-300">
            <p className="mb-1.5 font-medium">Setup steps:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-purple-700 dark:text-purple-400">
              <li>
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Create a Slack app</a> (From scratch)
              </li>
              <li>
                Go to <strong>OAuth &amp; Permissions</strong> and add Bot Token Scopes: <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">chat:write</code>, <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">channels:read</code>, and <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">channels:history</code>
              </li>
              <li>Click <strong>Install to Workspace</strong> and copy the Bot token below</li>
              <li>Copy the <strong>Signing Secret</strong> from Basic Information</li>
              <li>Create a channel, invite the bot with <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">/invite @YourBot</code>, and copy the Channel ID</li>
              <li>Go to <strong>Event Subscriptions</strong> and toggle it on (don&apos;t paste the URL yet)</li>
              <li>Under <strong>Subscribe to bot events</strong>, add <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">message.channels</code> and click Save</li>
              <li>Click <strong>Create</strong> below -- the Request URL to paste will be shown</li>
            </ol>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Bot token <span className="text-red-400">*</span>
            </label>
            <input
              value={slackBotToken ?? ""}
              onChange={(e) => onSlackBotTokenChange(e.target.value)}
              placeholder="xoxb-..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Found under OAuth &amp; Permissions in your{" "}
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Slack app settings</a>.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Signing secret <span className="text-red-400">*</span>
            </label>
            <input
              value={slackSigningSecret ?? ""}
              onChange={(e) => onSlackSigningSecretChange(e.target.value)}
              placeholder="abc123..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Found under Basic Information &gt; App Credentials in your Slack app.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Channel ID <span className="text-red-400">*</span>
            </label>
            <input
              value={slackChannelId ?? ""}
              onChange={(e) => onSlackChannelIdChange(e.target.value)}
              placeholder="C0123456789"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Right-click a channel in Slack, select &quot;View channel details&quot;, then copy the Channel ID.
            </p>
          </div>
          {tunnelActive === false && (
            <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Public access required.</strong> Enable a tunnel first so
                webhooks can reach your server.
              </span>
            </div>
          )}
          {tunnelActive === true && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
              <span>Public access is active — webhooks will be registered automatically.</span>
            </div>
          )}
        </div>
      )}

      {selected === "openclaw" && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-300">
          <p className="mb-1 font-medium">How OpenClaw works:</p>
          <ol className="list-decimal list-inside space-y-1 text-orange-700 dark:text-orange-400">
            <li>A provider key will be generated after creation</li>
            <li>
              Install the HeySummon provider skill from{" "}
              <a
                href="https://clawhub.ai/thomasansems/heysummon-provider"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                clawhub.ai
              </a>
            </li>
            <li>Configure it with your provider key — done!</li>
          </ol>
        </div>
      )}
    </div>
  );
}
