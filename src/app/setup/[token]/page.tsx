import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import SetupFlow from "./SetupFlow";

type ClientChannel = "openclaw" | "claudecode" | "codex" | "gemini" | "cursor";

interface SetupPayload {
  keyId: string;
  key: string;
  baseUrl: string;
  channel: ClientChannel;
  subChannel?: "telegram" | "whatsapp" | null;
  providerName?: string | null;
  timeout?: number;
  pollInterval?: number;
  globalInstall?: boolean;
  exp: number;
}

async function verifyToken(token: string): Promise<SetupPayload | null> {
  try {
    const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "heysummon-setup-secret";
    const payload = jwt.verify(token, secret) as SetupPayload;
    return payload;
  } catch {
    return null;
  }
}

async function isKeyBound(keyId: string): Promise<boolean> {
  const boundIp = await prisma.ipEvent.findFirst({
    where: { apiKeyId: keyId, status: "allowed" },
    select: { id: true },
  });
  return !!boundIp;
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

  const providerName = payload.providerName ?? "your provider";
  const expired = Date.now() / 1000 > payload.exp;
  const bound = !expired && await isKeyBound(payload.keyId);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <img src="/hey-summon.png" alt="HeySummon logo" className="h-8 w-8" />
            <h1 className="text-2xl font-bold text-white">HeySummon Setup</h1>
          </div>
          {!bound && !expired && (
            <p className="text-sm text-zinc-400">
              You&apos;ve been invited to connect to{" "}
              <span className="font-medium text-white">&quot;{providerName}&quot;</span>.
              Follow the steps below — your credentials are already pre-filled.
            </p>
          )}
        </div>

        {/* Interactive setup flow (Client Component) — credentials only passed when not bound */}
        <SetupFlow
          keyId={payload.keyId}
          apiKey={bound ? "" : payload.key}
          baseUrl={bound ? "" : payload.baseUrl}
          channel={payload.channel}
          subChannel={payload.subChannel}
          providerName={providerName}
          expiresAt={payload.exp}
          initialBound={bound}
          timeout={payload.timeout}
          pollInterval={payload.pollInterval}
          globalInstall={payload.globalInstall}
        />

        <div className="mt-10 text-center text-xs text-zinc-600">
          HeySummon — Human-in-the-loop for AI agents ·{" "}
          <a href="https://heysummon.app" className="text-zinc-500 underline hover:text-zinc-400">
            heysummon.app
          </a>{" "}
          ·{" "}
          <a href="/help" className="text-zinc-500 underline hover:text-zinc-400">
            Help & FAQ
          </a>
        </div>
      </div>
    </div>
  );
}
