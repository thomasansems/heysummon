"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StepCompleteProps {
  providerName: string;
  clientName: string;
}

export function StepComplete({ providerName, clientName }: StepCompleteProps) {
  const router = useRouter();
  const [completing, setCompleting] = useState(true);

  useEffect(() => {
    const complete = async () => {
      try {
        await fetch("/api/onboarding/complete", { method: "POST" });
      } finally {
        setCompleting(false);
      }
    };
    complete();
  }, []);

  return (
    <div className="text-center">
      <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground">
        You&apos;re all set!
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        HeySummon is configured and ready to use. Your AI assistants can now summon
        human experts when they need help.
      </p>

      <div className="mb-8 space-y-2 text-left">
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white">
            ✓
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Provider: {providerName}
            </p>
            <p className="text-xs text-muted-foreground">Connected and verified</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white">
            ✓
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Client: {clientName || "Unnamed"}
            </p>
            <p className="text-xs text-muted-foreground">Connected and verified</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push("/dashboard")}
        disabled={completing}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-40 transition-colors"
      >
        {completing ? "Finishing setup..." : "Go to Dashboard"}
      </button>

      <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
        <a href="/dashboard/providers" className="hover:text-foreground">
          Manage Providers
        </a>
        <span>·</span>
        <a href="/dashboard/clients" className="hover:text-foreground">
          Manage Clients
        </a>
        <span>·</span>
        <a href="/help" className="hover:text-foreground">
          Help & FAQ
        </a>
      </div>
    </div>
  );
}
