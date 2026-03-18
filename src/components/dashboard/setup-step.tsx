"use client";

import { useState } from "react";

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available (e.g. non-https) — silently ignore
    }
  }

  return (
    <div className="group relative rounded-lg bg-zinc-950 border border-zinc-800 p-4">
      <pre className="overflow-x-auto font-mono text-sm text-green-400 whitespace-pre-wrap break-all pr-12">{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 hover:text-white"
        aria-label="Copy to clipboard"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export type StepStatus = "idle" | "done" | "active";

export function Step({
  number,
  total,
  title,
  status = "idle",
  children,
}: {
  number: number;
  total?: number;
  title: string;
  status?: StepStatus;
  children: React.ReactNode;
}) {
  const isActive = status === "active";
  const isDone = status === "done";

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        isActive
          ? "border-orange-600/60 bg-orange-950/20"
          : isDone
          ? "border-green-700/40 bg-green-950/20"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isDone
              ? "bg-green-600 text-white"
              : isActive
              ? "bg-orange-600 text-white"
              : "bg-zinc-700 text-zinc-300"
          }`}
        >
          {isDone ? "✓" : number}
        </span>
        <div className="flex flex-1 items-center justify-between gap-2">
          <h2 className="font-semibold text-white">{title}</h2>
          {total && (
            <span className="text-xs text-zinc-600">
              {number} / {total}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
