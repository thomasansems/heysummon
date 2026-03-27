import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HeySummon — Coming Soon",
  description: "When your AI gets stuck, summon a human expert. Join the waitlist.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Joti+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: "#0f1410",
        color: "#9a958e",
        overflowX: "hidden",
      }}>
        {children}
      </body>
    </html>
  );
}
