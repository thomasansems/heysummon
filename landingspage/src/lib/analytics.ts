/**
 * Lightweight, privacy-friendly analytics abstraction.
 *
 * Supports Umami as the primary backend. When no analytics provider is
 * configured (VITE_UMAMI_WEBSITE_ID not set), events are logged to the
 * console in development and silently discarded in production.
 *
 * All events are automatically tagged with the current A/B variant.
 */

import { getVariant } from './ab-test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  name: string;
  data?: Record<string, string | number | boolean>;
}

// Umami global type (injected via script tag)
declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

const isDev = import.meta.env.DEV;

function enrichWithVariant(
  data?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return { variant: getVariant(), ...data };
}

/**
 * Track a named event with optional key/value data.
 * Every event is enriched with the current A/B variant tag.
 */
export function trackEvent(name: string, data?: Record<string, string | number | boolean>): void {
  const enriched = enrichWithVariant(data);

  if (window.umami) {
    window.umami.track(name, enriched);
    return;
  }

  if (isDev) {
    console.debug('[analytics]', name, enriched);
  }
}

/**
 * Track a page view. Called once on mount by AnalyticsProvider.
 * Umami handles page views automatically via its script tag, so this
 * only fires a custom event with variant metadata for correlation.
 */
export function trackPageView(): void {
  trackEvent('page_view', {
    path: window.location.pathname,
    referrer: document.referrer || 'direct',
  });
}

// ---------------------------------------------------------------------------
// CTA click helpers (convenience wrappers)
// ---------------------------------------------------------------------------

export function trackWaitlistClick(location: string): void {
  trackEvent('cta_waitlist', { location });
}

export function trackDocsClick(location: string): void {
  trackEvent('cta_docs', { location });
}

export function trackGithubClick(location: string): void {
  trackEvent('cta_github', { location });
}

// ---------------------------------------------------------------------------
// Scroll depth tracking
// ---------------------------------------------------------------------------

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;
const firedMilestones = new Set<number>();

function getScrollPercent(): number {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return 100;
  return Math.round((window.scrollY / docHeight) * 100);
}

function onScroll(): void {
  const pct = getScrollPercent();
  for (const milestone of SCROLL_MILESTONES) {
    if (pct >= milestone && !firedMilestones.has(milestone)) {
      firedMilestones.add(milestone);
      trackEvent('scroll_depth', { percent: milestone });
    }
  }
}

let scrollListenerAttached = false;

export function startScrollTracking(): () => void {
  if (scrollListenerAttached) return () => {};
  scrollListenerAttached = true;
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    scrollListenerAttached = false;
    firedMilestones.clear();
  };
}

// ---------------------------------------------------------------------------
// Time on page tracking
// ---------------------------------------------------------------------------

const TIME_MILESTONES = [10, 30, 60, 120, 300] as const; // seconds
const firedTimeMilestones = new Set<number>();
let timeInterval: ReturnType<typeof setInterval> | null = null;
let pageStartTime = 0;

export function startTimeOnPageTracking(): () => void {
  pageStartTime = Date.now();
  firedTimeMilestones.clear();

  timeInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - pageStartTime) / 1000);
    for (const milestone of TIME_MILESTONES) {
      if (elapsed >= milestone && !firedTimeMilestones.has(milestone)) {
        firedTimeMilestones.add(milestone);
        trackEvent('time_on_page', { seconds: milestone });
      }
    }
  }, 5000);

  return () => {
    if (timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
    firedTimeMilestones.clear();
  };
}

// ---------------------------------------------------------------------------
// Bounce detection
// ---------------------------------------------------------------------------

let interacted = false;

function markInteraction(): void {
  if (interacted) return;
  interacted = true;
  trackEvent('engagement', { type: 'interaction' });
  window.removeEventListener('click', markInteraction);
  window.removeEventListener('scroll', markInteraction);
}

export function startBounceDetection(): () => void {
  interacted = false;
  window.addEventListener('click', markInteraction, { once: true, passive: true });
  window.addEventListener('scroll', markInteraction, { once: true, passive: true });

  const onBeforeUnload = (): void => {
    if (!interacted) {
      trackEvent('bounce');
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    window.removeEventListener('click', markInteraction);
    window.removeEventListener('scroll', markInteraction);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
