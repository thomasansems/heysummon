"use client";

import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const SKIP_ONBOARDING = process.env.NEXT_PUBLIC_SKIP_ONBOARDING === "true";
const FORCE_ONBOARDING = process.env.NEXT_PUBLIC_FORCE_ONBOARDING === "true";

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const shouldRedirect =
    !SKIP_ONBOARDING &&
    status === "authenticated" &&
    (FORCE_ONBOARDING || session?.user?.onboardingComplete === false);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/onboarding");
    }
  }, [shouldRedirect, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (shouldRedirect) {
    return null;
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
