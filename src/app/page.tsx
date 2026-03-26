import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/nav";
import { HeroSection } from "@/components/landing/hero";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { FeaturesSection } from "@/components/landing/features";
import { UseCasesSection } from "@/components/landing/use-cases";
import { FaqSection } from "@/components/landing/faq";
import { CtaSection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "HeySummon - Human-in-the-Loop for AI Agents",
  description:
    "Self-hosted platform that lets AI agents summon expert approval when they need it. Secure, private, and under your control.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
