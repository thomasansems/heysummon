import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HeySummon — Coming Soon",
  description: "Join the waitlist for HeySummon Cloud — the expert network for AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#fafafa" }}>
        {children}
      </body>
    </html>
  );
}
