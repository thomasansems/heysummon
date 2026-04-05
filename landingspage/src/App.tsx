/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { VideoSection } from './components/VideoSection';
import { ExpertsSection } from './components/ExpertsSection';
import { ClientsSection } from './components/ClientsSection';
import { FlowSection } from './components/FlowSection';
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
          <ExpertsSection />
          <ClientsSection />
          <FlowSection />
          <FrameworksSection />
          <SecuritySection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </AnalyticsProvider>
  );
}
