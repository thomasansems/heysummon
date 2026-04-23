"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Phone, ShieldAlert, ShieldCheck, Clock, Lock } from "lucide-react";
import { ChatDisplay } from "./chat-display";
import { ResponseForm } from "./response-form";
import { StatusBadge } from "./status-badge";
import { NotificationAck } from "./notification-ack";
import { NotificationBadge } from "./notification-badge";
import {
  generateDashboardKeys,
  decryptDashboardMessage,
  encryptDashboardMessage,
  isWebCryptoE2ESupported,
  type DashboardKeyPair,
  type EncryptedPayload,
} from "@/lib/dashboard-crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LegacyMessage {
  role: "user" | "assistant";
  content: string;
}

interface ContentFlag {
  type: "xss" | "url" | "credit_card" | "phone" | "email" | "ssn_bsn";
  original: string;
  replacement: string;
}

interface HelpRequestDetail {
  id: string;
  status: string;
  question: string | null;
  messages: LegacyMessage[];
  response: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  deliveredAt: string | null;
  apiKey: { name: string | null };
  phoneCallStatus: string | null;
  phoneCallAt: string | null;
  phoneCallResponse: string | null;
  phoneCallSid: string | null;
  clientTimedOutAt: string | null;
  contentFlags: ContentFlag[] | null;
  guardVerified: boolean;
  responseRequired: boolean;
  acknowledgedAt: string | null;
}

interface E2ERawMessage {
  id: string;
  from: "consumer" | "expert";
  plaintext?: string;
  ciphertext?: string;
  iv?: string;
  authTag?: string;
  signature?: string;
  messageId: string;
  createdAt: string;
}

interface E2EData {
  requestId: string;
  status: string;
  consumerSignPubKey: string | null;
  consumerEncryptPubKey: string | null;
  expertSignPubKey: string | null;
  expertEncryptPubKey: string | null;
  messages: E2ERawMessage[];
  expiresAt: string;
}

export interface DecryptedE2EMessage {
  id: string;
  from: "consumer" | "expert";
  messageId: string;
  createdAt: string;
  plaintext: string;
  decryptError?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLAG_LABELS: Record<string, string> = {
  xss: "Script injection (XSS)",
  url: "URL defanged",
  credit_card: "Credit card detected",
  phone: "Phone number redacted",
  email: "Email address redacted",
  ssn_bsn: "SSN/BSN detected",
};

const FLAG_COLORS: Record<string, string> = {
  xss: "text-red-500",
  credit_card: "text-red-500",
  ssn_bsn: "text-red-500",
  url: "text-amber-500",
  email: "text-blue-500",
  phone: "text-blue-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<HelpRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // E2E state
  const [e2eActive, setE2eActive] = useState(false);
  const [e2eMessages, setE2eMessages] = useState<DecryptedE2EMessage[]>([]);
  const [e2eKeyExchangeDone, setE2eKeyExchangeDone] = useState(false);
  const [e2eSupported, setE2eSupported] = useState(true);
  const keysRef = useRef<DashboardKeyPair | null>(null);
  const e2eDataRef = useRef<E2EData | null>(null);
  const keyExchangeInProgress = useRef(false);

  // Check Web Crypto support once
  useEffect(() => {
    isWebCryptoE2ESupported().then(setE2eSupported);
  }, []);

  // ── Fetch legacy request data (server-side decryption) ──
  const fetchRequest = useCallback(() => {
    fetch(`/api/v1/requests/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setRequest(data.request))
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // ── Fetch E2E encrypted messages ──
  const fetchE2EMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/e2e/${id}`);
      if (!res.ok) return;
      const data: E2EData = await res.json();
      e2eDataRef.current = data;

      const hasConsumerKeys =
        !!data.consumerSignPubKey && !!data.consumerEncryptPubKey;

      if (!hasConsumerKeys) {
        // Not an E2E request
        setE2eActive(false);
        return;
      }

      setE2eActive(true);

      // Auto key-exchange: generate expert keys and POST them
      if (
        !data.expertSignPubKey &&
        !keyExchangeInProgress.current &&
        e2eSupported
      ) {
        keyExchangeInProgress.current = true;
        try {
          const keys = await generateDashboardKeys();
          keysRef.current = keys;

          const keRes = await fetch(`/api/v1/key-exchange/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signPublicKey: keys.signPublicKeyHex,
              encryptPublicKey: keys.encryptPublicKeyHex,
            }),
          });

          if (keRes.ok) {
            setE2eKeyExchangeDone(true);
            // Re-fetch to get updated keys
            const refreshed = await fetch(`/api/dashboard/e2e/${id}`);
            if (refreshed.ok) {
              const refreshedData: E2EData = await refreshed.json();
              e2eDataRef.current = refreshedData;
              await decryptMessages(refreshedData);
            }
          }
        } finally {
          keyExchangeInProgress.current = false;
        }
        return;
      }

      if (data.expertSignPubKey) {
        setE2eKeyExchangeDone(true);
      }

      // Decrypt messages if we have keys
      await decryptMessages(data);
    } catch {
      // E2E fetch failed — fall back to legacy view
    }
  }, [id, e2eSupported]);

  async function decryptMessages(data: E2EData) {
    if (
      !data.consumerSignPubKey ||
      !data.consumerEncryptPubKey ||
      !keysRef.current
    ) {
      // Show plaintext messages only (e.g. Telegram replies)
      const plainOnly: DecryptedE2EMessage[] = data.messages
        .filter((m) => m.plaintext)
        .map((m) => ({
          id: m.id,
          from: m.from,
          messageId: m.messageId,
          createdAt: m.createdAt,
          plaintext: m.plaintext!,
        }));
      setE2eMessages(plainOnly);
      return;
    }

    const decrypted: DecryptedE2EMessage[] = [];

    for (const msg of data.messages) {
      // Already plaintext (Telegram replies, etc.)
      if (msg.plaintext) {
        decrypted.push({
          id: msg.id,
          from: msg.from,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          plaintext: msg.plaintext,
        });
        continue;
      }

      if (!msg.ciphertext || !msg.iv || !msg.authTag || !msg.signature) {
        continue;
      }

      try {
        // Determine which keys to use for signature verification + DH
        // Consumer messages: verify with consumer sign key, DH with consumer enc key
        // Expert messages: we sent them — verify with our own sign key, DH with consumer enc key
        const signPubHex =
          msg.from === "consumer"
            ? data.consumerSignPubKey!
            : data.expertSignPubKey!;
        const encPubHex = data.consumerEncryptPubKey!;

        const plaintext = await decryptDashboardMessage(
          {
            ciphertext: msg.ciphertext,
            iv: msg.iv,
            authTag: msg.authTag,
            signature: msg.signature,
            messageId: msg.messageId,
          },
          encPubHex,
          keysRef.current.encryptKeyPair.privateKey,
          signPubHex,
        );

        decrypted.push({
          id: msg.id,
          from: msg.from,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          plaintext,
        });
      } catch {
        decrypted.push({
          id: msg.id,
          from: msg.from,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          plaintext: "[Decryption failed]",
          decryptError: true,
        });
      }
    }

    setE2eMessages(decrypted);
  }

  useEffect(() => {
    fetchE2EMessages();
  }, [fetchE2EMessages]);

  // Poll both endpoints
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequest();
      fetchE2EMessages();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequest, fetchE2EMessages]);

  // ── Encrypt and send handler for ResponseForm ──
  const handleE2ESend = useCallback(
    async (text: string): Promise<{ success: boolean; error?: string }> => {
      if (!keysRef.current || !e2eDataRef.current?.consumerEncryptPubKey) {
        return { success: false, error: "E2E keys not available" };
      }

      let payload: EncryptedPayload;
      try {
        payload = await encryptDashboardMessage(
          text,
          e2eDataRef.current.consumerEncryptPubKey,
          keysRef.current.signKeyPair.privateKey,
          keysRef.current.encryptKeyPair.privateKey,
        );
      } catch {
        return { success: false, error: "Encryption failed" };
      }

      const res = await fetch(`/api/dashboard/e2e/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "expert",
          ...payload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        return { success: false, error: data.error };
      }

      // Re-fetch messages to show the sent message
      await fetchE2EMessages();
      fetchRequest();
      return { success: true };
    },
    [id, fetchE2EMessages, fetchRequest],
  );

  // ── Render ──

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-zinc-500">{error || "Request not found"}</p>
        <Link
          href="/dashboard/requests"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/requests"
            className="mb-2 inline-block text-sm text-zinc-400 hover:text-zinc-200"
          >
            &larr; Back to requests
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">
              {request.responseRequired === false ? "Notification" : "Help Request"}
            </h1>
            {request.responseRequired === false && <NotificationBadge />}
            <StatusBadge status={request.status} />
            {request.responseRequired === false ? null : request.deliveredAt ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                Delivered
              </span>
            ) : request.status !== "closed" && request.status !== "expired" ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                Not delivered
              </span>
            ) : null}
            {request.clientTimedOutAt && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 text-xs font-medium"
                title={`Client timed out: ${new Date(request.clientTimedOutAt).toLocaleString()}`}
              >
                <Clock className="h-3 w-3" />
                Client Timed Out
              </span>
            )}
            {e2eActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                <Lock className="h-3 w-3" />
                End-to-End Encrypted
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(request.createdAt).toLocaleString()} · via{" "}
            {request.apiKey.name || "Unnamed key"} · Expires{" "}
            {new Date(request.expiresAt).toLocaleString()}
            {request.deliveredAt && (
              <> · Delivered {new Date(request.deliveredAt).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>

      {request.responseRequired !== false && request.phoneCallStatus && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phone Call
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Status:{" "}
              <span
                className={
                  {
                    initiated: "text-blue-500",
                    ringing: "text-blue-500",
                    answered: "text-green-500",
                    completed: "text-green-500",
                    "no-answer": "text-amber-500",
                    busy: "text-amber-500",
                    failed: "text-red-500",
                  }[request.phoneCallStatus] || "text-muted-foreground"
                }
              >
                {
                  {
                    initiated: "Calling...",
                    ringing: "Ringing...",
                    answered: "On call",
                    completed: "Answered",
                    "no-answer": "No answer -- fell back to chat",
                    busy: "Busy -- fell back to chat",
                    failed: "Call failed -- fell back to chat",
                  }[request.phoneCallStatus] || request.phoneCallStatus
                }
              </span>
            </span>
            {request.phoneCallAt && (
              <span className="text-muted-foreground">
                Called at{" "}
                {new Date(request.phoneCallAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {request.phoneCallResponse && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Verbal response
              </p>
              <p className="text-sm">{request.phoneCallResponse}</p>
            </div>
          )}
        </div>
      )}

      {request.contentFlags && request.contentFlags.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
              Content Safety Flags
            </p>
          </div>
          <div className="space-y-2">
            {request.contentFlags.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                <span
                  className={`font-medium ${FLAG_COLORS[flag.type] || "text-muted-foreground"}`}
                >
                  {FLAG_LABELS[flag.type] || flag.type}
                </span>
              </div>
            ))}
          </div>
          {request.guardVerified && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              Content was sanitized by the guard before storage
            </div>
          )}
        </div>
      )}

      {!request.contentFlags?.length && request.guardVerified && (
        <div className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          Verified clean by guard
        </div>
      )}

      {request.question && (
        <div className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            User&apos;s Question
          </p>
          <p className="text-sm text-zinc-200">{request.question}</p>
        </div>
      )}

      {/* E2E encrypted messages — shown when E2E is active */}
      {request.responseRequired !== false && e2eActive && e2eMessages.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-400">
              Encrypted Messages ({e2eMessages.length})
            </h2>
            <Lock className="h-3.5 w-3.5 text-green-500" />
          </div>
          <div className="rounded-xl border border-border bg-card/30 p-5">
            <ChatDisplay messages={e2eMessages} variant="e2e" />
          </div>
        </div>
      )}

      {/* Legacy chat history (server-decrypted) — hidden when E2E replaces it */}
      {request.responseRequired !== false &&
        (!e2eActive || e2eMessages.length === 0) &&
        request.messages.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              Chat History ({request.messages.length} messages)
            </h2>
            <div className="rounded-xl border border-border bg-card/30 p-5">
              <ChatDisplay messages={request.messages} variant="legacy" />
            </div>
          </div>
        )}

      {/* E2E unsupported warning */}
      {request.responseRequired !== false && e2eActive && !e2eSupported && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
          Your browser does not support Web Crypto Ed25519/X25519. E2E
          encrypted messages cannot be decrypted. Please use Chrome 113+,
          Firefox 125+, or Safari 17+.
        </div>
      )}

      {request.responseRequired === false ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            Acknowledge
          </h2>
          <NotificationAck
            requestId={request.id}
            status={request.status}
            acknowledgedAt={request.acknowledgedAt}
            expiresAt={request.expiresAt}
            onAcknowledged={fetchRequest}
          />
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            Expert Response
          </h2>
          {e2eActive && e2eKeyExchangeDone && e2eSupported ? (
            <ResponseForm
              requestId={request.id}
              currentStatus={request.status}
              existingResponse={request.response}
              e2e
              onE2ESend={handleE2ESend}
            />
          ) : (
            <ResponseForm
              requestId={request.id}
              currentStatus={request.status}
              existingResponse={request.response}
            />
          )}
        </div>
      )}
    </div>
  );
}
