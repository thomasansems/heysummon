/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, Component, type ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { VideoSection } from './components/VideoSection';
import { SkillSection } from './components/SkillSection';
import { FrameworksSection } from './components/FrameworksSection';
import { SecuritySection } from './components/SecuritySection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { AnalyticsProvider } from './components/AnalyticsProvider';
import { isVariant } from './lib/ab-test';

// Variant B: lazy-loaded so it has zero cost on the control path
const JapaneseApp = lazy(() => import('./variants/japanese/JapaneseApp'));

// ---------------------------------------------------------------------------
// ErrorBoundary: falls back to Control A if the variant chunk fails to load
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class VariantErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Control (A) — existing landing page, zero changes
// ---------------------------------------------------------------------------

function ControlApp() {
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

// ---------------------------------------------------------------------------
// App root — A/B router
// ---------------------------------------------------------------------------

export default function App() {
  const control = <ControlApp />;

  if (isVariant()) {
    return (
      <AnalyticsProvider>
        <VariantErrorBoundary fallback={control}>
          <Suspense fallback={<div className="min-h-screen bg-[#1a1a2e]" />}>
            <JapaneseApp />
          </Suspense>
        </VariantErrorBoundary>
      </AnalyticsProvider>
    );
  }

  return (
    <AnalyticsProvider>
      {control}
    </AnalyticsProvider>
  );
}
