"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const SKIP_ONBOARDING = process.env.NEXT_PUBLIC_SKIP_ONBOARDING === "true";

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login?callbackUrl=/dashboard");
      return;
    }
    if (status !== "authenticated" || SKIP_ONBOARDING) {
      setCheckingSetup(false);
      return;
    }

    // Check actual DB state: if onboarding not yet complete and no expert/client configured, redirect
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.onboardingComplete && !data.hasExpert && !data.hasClient) {
          setNeedsOnboarding(true);
          router.replace("/onboarding");
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => {
        setCheckingSetup(false);
      });
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated" || checkingSetup || needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <OnboardingGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <PageHeader />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </OnboardingGuard>
    </SessionProvider>
  );
}
