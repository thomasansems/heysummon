import { describe, it, expect } from "vitest";

/**
 * Extracted from providers-content.tsx for testability.
 * This mirrors the getProviderStatus function exactly.
 */
interface ChannelProvider {
  id: string;
  type: string;
  name: string;
  status: string;
  config: string;
}

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface Provider {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  availableDays: string | null;
  phoneFirst: boolean;
  ipEvents: IpEvent[];
  channelProviders: ChannelProvider[];
  _count: { apiKeys: number };
  apiKeys: { id: string; name: string | null; clientChannel: string | null; clientSubChannel: string | null }[];
}

function getProviderStatus(
  p: Provider,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive) return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const telegramCh = p.channelProviders?.find((c) => c.type === "telegram");
  if (telegramCh) {
    if (telegramCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return telegramCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.channelProviders?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "—", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "prov_1",
    name: "Hank",
    key: "hs_prov_test",
    isActive: true,
    createdAt: new Date().toISOString(),
    timezone: "UTC",
    quietHoursStart: null,
    quietHoursEnd: null,
    availableDays: null,
    phoneFirst: false,
    ipEvents: [],
    channelProviders: [],
    _count: { apiKeys: 0 },
    apiKeys: [],
    ...overrides,
  };
}

function makeTelegramChannel(status = "connected"): ChannelProvider {
  return {
    id: "ch_1",
    type: "telegram",
    name: "Hank — Telegram",
    status,
    config: "{}",
  };
}

function makeOpenClawChannel(): ChannelProvider {
  return {
    id: "ch_2",
    type: "openclaw",
    name: "Hank — OpenClaw",
    status: "connected",
    config: "{}",
  };
}

describe("getProviderStatus", () => {
  describe("inactive provider", () => {
    it("returns Inactive regardless of channel or tunnel state", () => {
      const provider = makeProvider({
        isActive: false,
        channelProviders: [makeTelegramChannel("connected")],
      });
      expect(getProviderStatus(provider, true).label).toBe("Inactive");
      expect(getProviderStatus(provider, false).label).toBe("Inactive");
      expect(getProviderStatus(provider, null).label).toBe("Inactive");
    });
  });

  describe("telegram channel — tunnel is accessible", () => {
    it("returns Connected when channel status is connected", () => {
      const provider = makeProvider({
        channelProviders: [makeTelegramChannel("connected")],
      });
      const result = getProviderStatus(provider, true);
      expect(result.label).toBe("Connected");
    });

    it("returns Not connected when channel status is disconnected", () => {
      const provider = makeProvider({
        channelProviders: [makeTelegramChannel("disconnected")],
      });
      const result = getProviderStatus(provider, true);
      expect(result.label).toBe("Not connected");
    });
  });

  describe("telegram channel — tunnel is NOT accessible", () => {
    it("returns Unreachable when channel claims connected but tunnel is down", () => {
      const provider = makeProvider({
        channelProviders: [makeTelegramChannel("connected")],
      });
      const result = getProviderStatus(provider, false);
      expect(result.label).toBe("Unreachable");
    });

    it("returns Not connected when channel is disconnected and tunnel is down", () => {
      const provider = makeProvider({
        channelProviders: [makeTelegramChannel("disconnected")],
      });
      const result = getProviderStatus(provider, false);
      expect(result.label).toBe("Not connected");
    });
  });

  describe("telegram channel — tunnel status unknown (null)", () => {
    it("returns Connected when channel status is connected and tunnel unknown", () => {
      const provider = makeProvider({
        channelProviders: [makeTelegramChannel("connected")],
      });
      const result = getProviderStatus(provider, null);
      expect(result.label).toBe("Connected");
    });
  });

  describe("openclaw channel", () => {
    it("returns Bound when IP events include an allowed entry", () => {
      const provider = makeProvider({
        channelProviders: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "allowed", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getProviderStatus(provider, false).label).toBe("Bound");
    });

    it("returns No binding yet when no allowed IP events", () => {
      const provider = makeProvider({
        channelProviders: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "pending", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getProviderStatus(provider, false).label).toBe("No binding yet");
    });

    it("is not affected by tunnel status", () => {
      const provider = makeProvider({
        channelProviders: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "allowed", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getProviderStatus(provider, false).label).toBe("Bound");
      expect(getProviderStatus(provider, true).label).toBe("Bound");
    });
  });

  describe("no channels configured", () => {
    it("returns dash when provider has no channels", () => {
      const provider = makeProvider();
      expect(getProviderStatus(provider, true).label).toBe("\u2014");
    });
  });
});
