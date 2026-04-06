"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, LayoutDashboard, Users, Building2, HelpCircle } from "lucide-react";

interface StepCompleteProps {
  expertName: string;
  clientName: string;
}

export function StepComplete({ expertName, clientName }: StepCompleteProps) {
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
      <h2 className="mb-2 flex items-center justify-center gap-2 font-serif text-2xl font-semibold text-foreground">
        <Check className="h-6 w-6 text-green-600 shrink-0" />
        You&apos;re all set!
      </h2>
      <p className="mb-8 text-sm text-muted-foreground">
        Your AI assistants can now summon you when they need help.
      </p>

      <div className="mb-8 space-y-2 text-left">
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shrink-0">
            <Check className="h-3.5 w-3.5 text-white" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Expert: {expertName}
            </p>
            <p className="text-xs text-muted-foreground">Connected and verified</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shrink-0">
            <Check className="h-3.5 w-3.5 text-white" />
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
        <span className="flex items-center justify-center gap-2">
          {completing ? (
            "Finishing setup..."
          ) : (
            <>
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </>
          )}
        </span>
      </button>

      <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/dashboard/experts" className="inline-flex items-center gap-1 hover:text-foreground">
          <Users className="h-3 w-3" />
          Manage Experts
        </Link>
        <span>·</span>
        <Link href="/dashboard/clients" className="inline-flex items-center gap-1 hover:text-foreground">
          <Building2 className="h-3 w-3" />
          Manage Clients
        </Link>
        <span>·</span>
        <Link href="/help" className="inline-flex items-center gap-1 hover:text-foreground">
          <HelpCircle className="h-3 w-3" />
          Help & FAQ
        </Link>
      </div>
    </div>
  );
}
