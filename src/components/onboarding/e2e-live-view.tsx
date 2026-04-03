"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type E2eStatus =
  | "ready"
  | "sending"
  | "waiting_expert"
  | "waiting_response"
  | "complete"
  | "timeout";

interface E2eLiveViewProps {
  status: E2eStatus;
  expertChannel: string | null;
}

interface AnimLine {
  text: string;
  style: "dim" | "normal" | "accent" | "success";
  delay: number;
}

const TERMINAL_LINES: AnimLine[] = [
  { text: "$ claude", style: "dim", delay: 0 },
  { text: "> Working on auth module...", style: "normal", delay: 600 },
  { text: "> Need clarification from human expert.", style: "normal", delay: 1200 },
  { text: "", style: "dim", delay: 1600 },
  {
    text: '"The API spec mentions both JWT and session',
    style: "accent",
    delay: 2000,
  },
  {
    text: " auth. The mobile app needs stateless auth",
    style: "accent",
    delay: 2400,
  },
  {
    text: " but the web frontend uses cookies.",
    style: "accent",
    delay: 2800,
  },
  { text: "", style: "dim", delay: 3000 },
  { text: " Should I:", style: "accent", delay: 3200 },
  { text: " A) Use JWT for everything", style: "accent", delay: 3500 },
  { text: ' B) JWT for API, sessions for web"', style: "accent", delay: 3800 },
  { text: "", style: "dim", delay: 4000 },
  { text: "> Sending to HeySummon...", style: "dim", delay: 4200 },
  { text: "> Waiting for response...", style: "dim", delay: 5000 },
];

const TERMINAL_RESPONSE: AnimLine[] = [
  { text: "", style: "dim", delay: 0 },
  { text: "> Response received!", style: "success", delay: 0 },
  {
    text: '> "Use JWT for the API and mobile. Keep',
    style: "success",
    delay: 400,
  },
  {
    text: '  sessions for the web frontend."',
    style: "success",
    delay: 600,
  },
  { text: "", style: "dim", delay: 800 },
  { text: "> Got it. Implementing JWT + sessions...", style: "normal", delay: 1200 },
];

interface ChatMsg {
  from: "system" | "expert";
  text: string;
  delay: number;
}

const CHAT_MESSAGES: ChatMsg[] = [
  {
    from: "system",
    text: "Your agent needs help:",
    delay: 4500,
  },
  {
    from: "system",
    text: '"JWT for everything, or JWT for API + sessions for web?"',
    delay: 5200,
  },
];

const CHAT_RESPONSE: ChatMsg = {
  from: "expert",
  text: "JWT for API and mobile. Sessions for web.",
  delay: 7500,
};

function useTypedLines(
  lines: AnimLine[],
  active: boolean,
  baseDelay = 0
): string[] {
  const [visible, setVisible] = useState<string[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setVisible([]);

    lines.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisible((prev) => [...prev, line.text]);
      }, line.delay + baseDelay);
      timersRef.current.push(t);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [active, baseDelay]);

  return visible;
}

export function E2eLiveView({ status, expertChannel }: E2eLiveViewProps) {
  const isActive = status !== "ready";
  const isComplete = status === "complete";

  const termLines = useTypedLines(TERMINAL_LINES, isActive);
  const respLines = useTypedLines(TERMINAL_RESPONSE, isComplete, 0);

  const [chatVisible, setChatVisible] = useState<ChatMsg[]>([]);
  const [showExpertResp, setShowExpertResp] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const chatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Chat messages appear based on timing
  useEffect(() => {
    if (!isActive) return;
    chatTimersRef.current.forEach(clearTimeout);
    chatTimersRef.current = [];
    setChatVisible([]);
    setShowExpertResp(false);
    setShowDelivered(false);

    CHAT_MESSAGES.forEach((msg) => {
      const t = setTimeout(() => {
        setChatVisible((prev) => [...prev, msg]);
      }, msg.delay);
      chatTimersRef.current.push(t);
    });

    return () => chatTimersRef.current.forEach(clearTimeout);
  }, [isActive]);

  // Expert response appears when real test completes
  useEffect(() => {
    if (!isComplete) return;
    const t1 = setTimeout(() => setShowExpertResp(true), 300);
    const t2 = setTimeout(() => setShowDelivered(true), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isComplete]);

  const channelLabel =
    expertChannel === "openclaw" ? "OpenClaw" : "Telegram";

  // Combine terminal lines
  const allTermLines = [...termLines, ...respLines];

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      {/* Terminal side — agent perspective */}
      <div className="flex-1 rounded-lg border border-border bg-[#0d1117] p-4 overflow-hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            AI Agent
          </span>
        </div>
        <div className="space-y-0.5 font-mono text-xs leading-relaxed">
          {allTermLines.map((line, i) => {
            const orig = i < TERMINAL_LINES.length
              ? TERMINAL_LINES[i]
              : TERMINAL_RESPONSE[i - TERMINAL_LINES.length];
            if (!orig) return null;
            return (
              <div
                key={i}
                className={`animate-in fade-in duration-200 ${
                  orig.style === "dim"
                    ? "text-zinc-500"
                    : orig.style === "accent"
                      ? "text-blue-400"
                      : orig.style === "success"
                        ? "text-green-400"
                        : "text-zinc-300"
                }`}
              >
                {line || "\u00A0"}
              </div>
            );
          })}
          {isActive && !isComplete && termLines.length >= TERMINAL_LINES.length && (
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-zinc-400" />
          )}
        </div>
      </div>

      {/* Chat side — expert perspective */}
      <div className="flex-1 rounded-lg border border-border bg-background p-4 overflow-hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary">HS</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            You ({channelLabel})
          </span>
        </div>
        <div className="space-y-2">
          {chatVisible.map((msg, i) => (
            <div
              key={i}
              className={`animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg px-3 py-2 text-xs ${
                msg.from === "system"
                  ? "bg-muted/50 text-foreground"
                  : "bg-primary/10 text-foreground ml-8"
              }`}
            >
              {msg.from === "system" && (
                <span className="block text-[10px] font-medium text-primary mb-0.5">
                  HeySummon
                </span>
              )}
              {msg.text}
            </div>
          ))}
          {showExpertResp && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg bg-primary/10 px-3 py-2 text-xs text-foreground ml-8">
              <span className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                You
              </span>
              {CHAT_RESPONSE.text}
            </div>
          )}
          {showDelivered && (
            <p className="animate-in fade-in duration-200 text-[10px] text-green-600 dark:text-green-400 text-right">
              Response delivered to agent
            </p>
          )}
          {!isActive && (
            <p className="text-xs text-muted-foreground/60 text-center py-4">
              Run the E2E test to see the live flow
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
