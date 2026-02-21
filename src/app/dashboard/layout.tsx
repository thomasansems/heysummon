"use client";

import { SessionProvider } from "next-auth/react";
import { TopNav } from "@/components/dashboard/top-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
        <TopNav />
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
