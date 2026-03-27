/**
 * Placeholder for the Japanese anime-art landing page variant.
 *
 * HEY-58 will replace this with the full variant implementation.
 * For now, variant visitors see the control page via the ErrorBoundary
 * fallback in App.tsx, but this module must exist so the lazy() import
 * resolves at build time.
 */

import { Navbar } from '../../components/Navbar';
import { Hero } from '../../components/Hero';
import { VideoSection } from '../../components/VideoSection';
import { SkillSection } from '../../components/SkillSection';
import { FrameworksSection } from '../../components/FrameworksSection';
import { SecuritySection } from '../../components/SecuritySection';
import { CTASection } from '../../components/CTASection';
import { Footer } from '../../components/Footer';

export default function JapaneseApp() {
  return (
    <div className="min-h-screen bg-bg-deep text-text-body font-sans selection:bg-primary/30">
      <Navbar />
      <main>
        <Hero />
        <VideoSection />
        <SkillSection />
        <FrameworksSection />
        <SecuritySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
