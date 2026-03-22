import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";
import SetupFlow from "./SetupFlow";

interface SetupPayload {
  keyId: string;
  key: string;
  baseUrl: string;
  channel: "openclaw" | "claudecode";
  subChannel?: "telegram" | "whatsapp" | null;
  providerName?: string | null;
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-3xl">🦞</span>
            <h1 className="text-2xl font-bold text-white">HeySummon Setup</h1>
          </div>
          <p className="text-sm text-zinc-400">
            You&apos;ve been invited to connect to{" "}
            <span className="font-medium text-white">&quot;{providerName}&quot;</span>.
            Follow the steps below — your credentials are already pre-filled.
          </p>
        </div>

        {/* Interactive setup flow (Client Component) */}
        <SetupFlow
          keyId={payload.keyId}
          apiKey={payload.key}
          baseUrl={payload.baseUrl}
          channel={payload.channel}
          subChannel={payload.subChannel}
          providerName={providerName}
          expiresAt={payload.exp}
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
