/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { VideoSection } from './components/VideoSection';
import { SkillSection } from './components/SkillSection';
import { FrameworksSection } from './components/FrameworksSection';
import { SecuritySection } from './components/SecuritySection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { AnalyticsProvider } from './components/AnalyticsProvider';

export default function App() {
  return (
    <AnalyticsProvider>
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
    </AnalyticsProvider>
  );
}
