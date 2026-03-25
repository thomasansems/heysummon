"use client";

export type ClientChannelType = "openclaw" | "claudecode" | "codex" | "gemini" | "cursor";
export type ClientSubChannelType = "telegram" | "whatsapp";

const CLIENT_CHANNELS = [
  {
    id: "openclaw" as const,
    label: "OpenClaw",
    icon: "/icons/openclaw.svg",
    description: "AI agent via Telegram or WhatsApp",
    disabled: false,
  },
  {
    id: "claudecode" as const,
    label: "Claude Code",
    icon: "/icons/claudecode.svg",
    description: "Anthropic — skill in editor",
    disabled: false,
  },
  {
    id: "codex" as const,
    label: "Codex CLI",
    icon: "/icons/codex.svg",
    description: "OpenAI — terminal agent",
    disabled: false,
  },
  {
    id: "cursor" as const,
    label: "Cursor",
    icon: "/icons/cursor.svg",
    description: "Cursor editor -- skill in rules",
    disabled: false,
  },
  {
    id: null,
    label: "Gemini CLI",
    icon: "/icons/gemini.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "OpenAI",
    icon: "/icons/openai.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "NanoClaw",
    icon: "/icons/docker.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "NemoClaw",
    icon: "/icons/nvidia.svg",
    description: "Coming soon",
    disabled: true,
  },
] as const;

const OPENCLAW_PLATFORMS = [
  { id: "telegram" as const, label: "Telegram", icon: "/icons/telegram.svg" },
  { id: "whatsapp" as const, label: "WhatsApp", icon: "/icons/whatsapp.svg" },
] as const;

interface ClientChannelSelectorProps {
  selected: ClientChannelType | null;
  subChannel: ClientSubChannelType | null;
  onSelect: (channel: ClientChannelType) => void;
  onSubChannelSelect: (sub: ClientSubChannelType) => void;
}

export function ClientChannelSelector({
  selected,
  subChannel,
  onSelect,
  onSubChannelSelect,
}: ClientChannelSelectorProps) {
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CLIENT_CHANNELS.map((ch) => (
          <button
            key={ch.label}
            type="button"
            disabled={ch.disabled}
            onClick={() => {
              if (!ch.disabled && ch.id) onSelect(ch.id);
            }}
            className={`relative rounded-lg border p-4 text-left transition-colors ${
              ch.disabled
                ? "cursor-not-allowed opacity-50 border-border"
                : selected === ch.id
                  ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30"
                  : "border-border hover:border-muted-foreground"
            }`}
          >
            {ch.disabled && (
              <span className="absolute right-2 top-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Soon
              </span>
            )}
            <div className="mb-2 flex items-center gap-2">
              <img
                src={ch.icon}
                alt={ch.label}
                className="h-7 w-7 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-sm font-medium text-foreground">{ch.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{ch.description}</p>
          </button>
        ))}
      </div>

      {selected === "openclaw" && (
        <div className="mb-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Where does the client use OpenClaw?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OPENCLAW_PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSubChannelSelect(p.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  subChannel === p.id
                    ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <img
                  src={p.icon}
                  alt={p.label}
                  className="h-7 w-7 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-sm font-medium text-foreground">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
