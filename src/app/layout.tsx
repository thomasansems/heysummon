import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const snPro = localFont({
  variable: "--font-serif",
  src: [
    { path: "../../public/fonts/SNPro-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/SNPro-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/SNPro-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/SNPro-Bold.ttf", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: "HeySummon Expert Portal",
  description: "Human in the Loop as a Service -- Expert Dashboard",
  icons: {
    icon: [{ url: "/hey-summon.png", type: "image/png" }],
    shortcut: "/hey-summon.png",
    apple: "/hey-summon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", dmSans.variable, snPro.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
