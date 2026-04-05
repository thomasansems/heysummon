"use client";

import { SessionProvider } from "next-auth/react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark" style={{ colorScheme: "dark" }}>
      <SessionProvider>{children}</SessionProvider>
    </div>
  );
}
