import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HeySummon — Coming Soon",
  description: "When your AI gets stuck, summon a human expert. Join the waitlist.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#050507", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
