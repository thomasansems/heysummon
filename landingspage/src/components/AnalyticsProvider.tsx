/**
 * Initializes all analytics tracking on mount:
 * - Page view event (with A/B variant tag)
 * - Scroll depth milestones (25%, 50%, 75%, 100%)
 * - Time on page milestones (10s, 30s, 60s, 2m, 5m)
 * - Bounce detection (fires if user leaves without interaction)
 *
 * Renders children unchanged — this is a side-effect-only wrapper.
 */

import { useEffect, type ReactNode } from 'react';
import {
  trackPageView,
  startScrollTracking,
  startTimeOnPageTracking,
  startBounceDetection,
} from '../lib/analytics';
import { getVariant } from '../lib/ab-test';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Ensure variant is assigned on first load (sets cookie if missing)
    getVariant();

    trackPageView();

    const cleanupScroll = startScrollTracking();
    const cleanupTime = startTimeOnPageTracking();
    const cleanupBounce = startBounceDetection();

    return () => {
      cleanupScroll();
      cleanupTime();
      cleanupBounce();
    };
  }, []);

  return <>{children}</>;
}
