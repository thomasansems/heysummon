import { describe, it, expect } from "vitest";

/**
 * Extracted from experts-content.tsx for testability.
 * This mirrors the getExpertStatus function exactly.
 */
interface ExpertChannel {
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

interface Expert {
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
  expertChannels: ExpertChannel[];
  _count: { apiKeys: number };
  apiKeys: { id: string; name: string | null; clientChannel: string | null; clientSubChannel: string | null }[];
}

function getExpertStatus(
  p: Expert,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive) return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const telegramCh = p.expertChannels?.find((c) => c.type === "telegram");
  if (telegramCh) {
    if (telegramCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return telegramCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.expertChannels?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "\u2014", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function makeExpert(overrides: Partial<Expert> = {}): Expert {
  return {
    id: "exp_1",
    name: "Hank",
    key: "hs_exp_test",
    isActive: true,
    createdAt: new Date().toISOString(),
    timezone: "UTC",
    quietHoursStart: null,
    quietHoursEnd: null,
    availableDays: null,
    phoneFirst: false,
    ipEvents: [],
    expertChannels: [],
    _count: { apiKeys: 0 },
    apiKeys: [],
    ...overrides,
  };
}

function makeTelegramChannel(status = "connected"): ExpertChannel {
  return {
    id: "ch_1",
    type: "telegram",
    name: "Hank \u2014 Telegram",
    status,
    config: "{}",
  };
}

function makeOpenClawChannel(): ExpertChannel {
  return {
    id: "ch_2",
    type: "openclaw",
    name: "Hank \u2014 OpenClaw",
    status: "connected",
    config: "{}",
  };
}

describe("getExpertStatus", () => {
  describe("inactive expert", () => {
    it("returns Inactive regardless of channel or tunnel state", () => {
      const expert = makeExpert({
        isActive: false,
        expertChannels: [makeTelegramChannel("connected")],
      });
      expect(getExpertStatus(expert, true).label).toBe("Inactive");
      expect(getExpertStatus(expert, false).label).toBe("Inactive");
      expect(getExpertStatus(expert, null).label).toBe("Inactive");
    });
  });

  describe("telegram channel \u2014 tunnel is accessible", () => {
    it("returns Connected when channel status is connected", () => {
      const expert = makeExpert({
        expertChannels: [makeTelegramChannel("connected")],
      });
      const result = getExpertStatus(expert, true);
      expect(result.label).toBe("Connected");
    });

    it("returns Not connected when channel status is disconnected", () => {
      const expert = makeExpert({
        expertChannels: [makeTelegramChannel("disconnected")],
      });
      const result = getExpertStatus(expert, true);
      expect(result.label).toBe("Not connected");
    });
  });

  describe("telegram channel \u2014 tunnel is NOT accessible", () => {
    it("returns Unreachable when channel claims connected but tunnel is down", () => {
      const expert = makeExpert({
        expertChannels: [makeTelegramChannel("connected")],
      });
      const result = getExpertStatus(expert, false);
      expect(result.label).toBe("Unreachable");
    });

    it("returns Not connected when channel is disconnected and tunnel is down", () => {
      const expert = makeExpert({
        expertChannels: [makeTelegramChannel("disconnected")],
      });
      const result = getExpertStatus(expert, false);
      expect(result.label).toBe("Not connected");
    });
  });

  describe("telegram channel \u2014 tunnel status unknown (null)", () => {
    it("returns Connected when channel status is connected and tunnel unknown", () => {
      const expert = makeExpert({
        expertChannels: [makeTelegramChannel("connected")],
      });
      const result = getExpertStatus(expert, null);
      expect(result.label).toBe("Connected");
    });
  });

  describe("openclaw channel", () => {
    it("returns Bound when IP events include an allowed entry", () => {
      const expert = makeExpert({
        expertChannels: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "allowed", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getExpertStatus(expert, false).label).toBe("Bound");
    });

    it("returns No binding yet when no allowed IP events", () => {
      const expert = makeExpert({
        expertChannels: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "pending", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getExpertStatus(expert, false).label).toBe("No binding yet");
    });

    it("is not affected by tunnel status", () => {
      const expert = makeExpert({
        expertChannels: [makeOpenClawChannel()],
        ipEvents: [{ id: "ip_1", ip: "1.2.3.4", status: "allowed", attempts: 1, firstSeen: "", lastSeen: "" }],
      });
      expect(getExpertStatus(expert, false).label).toBe("Bound");
      expect(getExpertStatus(expert, true).label).toBe("Bound");
    });
  });

  describe("no channels configured", () => {
    it("returns dash when expert has no channels", () => {
      const expert = makeExpert();
      expect(getExpertStatus(expert, true).label).toBe("\u2014");
    });
  });
});
