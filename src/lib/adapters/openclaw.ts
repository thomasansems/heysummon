import type { ChannelAdapter, OpenClawConfig } from "./types";

export const openClawAdapter: ChannelAdapter = {
  type: "openclaw",

  validateConfig(config: unknown) {
    if (!config || typeof config !== "object") {
      return { valid: false, error: "Config is required" };
    }

    const c = config as Record<string, unknown>;
    if (!c.apiKey || typeof c.apiKey !== "string" || c.apiKey.trim().length === 0) {
      return { valid: false, error: "API key is required" };
    }

    const validated: OpenClawConfig = {
      apiKey: c.apiKey.trim(),
      webhookUrl: typeof c.webhookUrl === "string" ? c.webhookUrl.trim() : undefined,
    };

    return { valid: true, config: validated };
  },
};
