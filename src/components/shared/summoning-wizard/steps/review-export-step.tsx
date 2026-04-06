"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface ReviewExportStepProps {
  generatedText: string;
  charLimit: number;
}

export function ReviewExportStep({
  generatedText,
  charLimit,
}: ReviewExportStepProps) {
  const [copied, setCopied] = useState(false);

  const isOverLimit = generatedText.length > charLimit;

  const handleCopy = () => {
    copyToClipboard(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Review your guidelines
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          This text will be included when your AI sets up its connection.
        </p>
      </div>

      <div className="rounded-md border border-border bg-black p-4">
        <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
          {generatedText}
        </pre>
      </div>

      <div className="flex items-center justify-between">
        <p
          className={`text-[11px] ${
            isOverLimit ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          {generatedText.length}/{charLimit}
          {isOverLimit && " -- exceeds limit"}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
