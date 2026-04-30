import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    expertChannel: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    helpRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/services/notifications/acknowledge", () => ({
  acknowledgeNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/adapters/discord/[id]/webhook/route";
import { NextRequest } from "next/server";

const mockChannelFindUnique = vi.mocked(prisma.expertChannel.findUnique);
const mockChannelUpdate = vi.mocked(prisma.expertChannel.update);

/**
 * Generate a fresh Ed25519 keypair and return the raw 32-byte public key as
 * the hex string Discord stores in the application config.
 */
function makeDiscordKeyPair(): { privateKey: KeyObject; publicKeyHex: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" });
  // Strip the 12-byte SPKI prefix to recover the raw 32-byte public key.
  const rawPub = spki.subarray(spki.length - 32);
  return { privateKey, publicKeyHex: rawPub.toString("hex") };
}

function signDiscordRequest(
  privateKey: KeyObject,
  timestamp: string,
  body: string,
): string {
  const message = Buffer.from(timestamp + body, "utf8");
  return sign(null, message, privateKey).toString("hex");
}

function makeRequest({
  body,
  signature,
  timestamp,
}: {
  body: string;
  signature: string;
  timestamp: string;
}) {
  return new NextRequest(
    "http://localhost/api/adapters/discord/ch-discord-1/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": signature,
        "x-signature-timestamp": timestamp,
      },
      body,
    },
  );
}

const params = Promise.resolve({ id: "ch-discord-1" });

describe("Discord webhook signature verification", () => {
  let publicKeyHex: string;
  let privateKey: KeyObject;
  let channelConfig: { publicKey: string };

  beforeEach(() => {
    vi.clearAllMocks();
    const kp = makeDiscordKeyPair();
    publicKeyHex = kp.publicKeyHex;
    privateKey = kp.privateKey;
    channelConfig = {
      publicKey: publicKeyHex,
    };
    mockChannelFindUnique.mockResolvedValue({
      id: "ch-discord-1",
      type: "discord",
      isActive: true,
      config: JSON.stringify({
        botToken: "tok",
        applicationId: "app",
        publicKey: channelConfig.publicKey,
        guildId: "g",
        channelId: "c",
      }),
      profile: { userId: "user-1" },
    } as never);
    mockChannelUpdate.mockResolvedValue({} as never);
  });

  it("rejects requests with no signature header", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const res = await POST(
      makeRequest({ body, signature: "", timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("rejects requests with no timestamp header", async () => {
    const body = JSON.stringify({ type: 1 });
    const signature = "00".repeat(64);

    const res = await POST(
      makeRequest({ body, signature, timestamp: "" }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("rejects requests signed with a different key", async () => {
    const otherKp = makeDiscordKeyPair();
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(otherKp.privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("rejects requests with malformed signature hex", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const res = await POST(
      makeRequest({ body, signature: "not-hex", timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
  });

  it("rejects stale timestamps (>300s in the past)", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(mockChannelUpdate).not.toHaveBeenCalled();
  });

  it("rejects far-future timestamps (>300s in the future)", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000) + 301);
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when the channel is not a discord channel", async () => {
    mockChannelFindUnique.mockResolvedValueOnce({
      id: "ch-discord-1",
      type: "slack",
      isActive: true,
      config: "{}",
      profile: { userId: "user-1" },
    } as never);

    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the channel is inactive", async () => {
    mockChannelFindUnique.mockResolvedValueOnce({
      id: "ch-discord-1",
      type: "discord",
      isActive: false,
      config: JSON.stringify({ publicKey: publicKeyHex }),
      profile: { userId: "user-1" },
    } as never);

    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 when the stored public key is malformed (does not throw)", async () => {
    mockChannelFindUnique.mockResolvedValueOnce({
      id: "ch-discord-1",
      type: "discord",
      isActive: true,
      config: JSON.stringify({ publicKey: "not-a-real-key" }),
      profile: { userId: "user-1" },
    } as never);

    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
  });

  it("does not parse the body before signature verification", async () => {
    // Malformed JSON: a real PING would also be malformed. With a bad
    // signature we must short-circuit at 403 before any parse attempt.
    const body = "{not-json";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = "00".repeat(64);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(403);
  });
});

describe("Discord webhook interaction routing", () => {
  let publicKeyHex: string;
  let privateKey: KeyObject;

  beforeEach(() => {
    vi.clearAllMocks();
    const kp = makeDiscordKeyPair();
    publicKeyHex = kp.publicKeyHex;
    privateKey = kp.privateKey;
    mockChannelFindUnique.mockResolvedValue({
      id: "ch-discord-1",
      type: "discord",
      isActive: true,
      config: JSON.stringify({
        botToken: "tok",
        applicationId: "app",
        publicKey: publicKeyHex,
        guildId: "g",
        channelId: "c",
      }),
      profile: { userId: "user-1" },
    } as never);
    mockChannelUpdate.mockResolvedValue({} as never);
  });

  it("responds to PING with PONG and updates heartbeat", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
    expect(mockChannelUpdate).toHaveBeenCalledWith({
      where: { id: "ch-discord-1" },
      data: { lastHeartbeat: expect.any(Date) },
    });
  });

  it("returns a deferred update for unknown component custom_ids", async () => {
    const body = JSON.stringify({
      type: 3,
      data: { custom_id: "unknown_action:req-1" },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 6 });
  });

  it("returns a deferred update for malformed component data", async () => {
    const body = JSON.stringify({ type: 3, data: { custom_id: "" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 6 });
  });

  it("returns an ephemeral channel message for MODAL_SUBMIT", async () => {
    const body = JSON.stringify({
      type: 5,
      data: { custom_id: "reply_modal:req-1" },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordRequest(privateKey, timestamp, body);

    const res = await POST(
      makeRequest({ body, signature, timestamp }),
      { params },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(4);
    // Discord ephemeral flag = 1 << 6
    expect(json.data.flags).toBe(64);
  });
});
