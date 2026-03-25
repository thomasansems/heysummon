"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard not available
        }
      }}
      className="absolute right-3 top-3 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 hover:text-white"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
