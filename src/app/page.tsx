import { Navigation } from "@/components/landing/navigation";
import { Hero } from "@/components/landing/hero";
import { Infrastructure } from "@/components/landing/infrastructure";
import { Lifecycle } from "@/components/landing/lifecycle";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CodeExamples } from "@/components/landing/code-examples";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white overflow-hidden">
      <Navigation />
      <Hero />
      <Infrastructure />
      <Lifecycle />
      <Problem />
      <HowItWorks />
      <CodeExamples />
      <Features />
      <Pricing />
      <Faq />
      <Footer />
    </main>
  );
}
