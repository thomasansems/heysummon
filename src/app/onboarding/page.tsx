"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OnboardingFlow } from "./onboarding-flow";

const FORCE_ONBOARDING = process.env.NEXT_PUBLIC_FORCE_ONBOARDING === "true";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
    if (
      !FORCE_ONBOARDING &&
      status === "authenticated" &&
      session?.user?.onboardingComplete
    ) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (
    status !== "authenticated" ||
    (!FORCE_ONBOARDING && session?.user?.onboardingComplete)
  ) {
    return null;
  }

  return <OnboardingFlow />;
}
