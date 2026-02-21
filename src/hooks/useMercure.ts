"use client";

import { useEffect, useRef, useCallback } from "react";

const MERCURE_HUB_URL = process.env.NEXT_PUBLIC_MERCURE_HUB_URL || "http://localhost:3100/.well-known/mercure";

export type MercureEventHandler = (data: Record<string, unknown>) => void;

/**
 * React hook for subscribing to Mercure topics via EventSource.
 *
 * @param topics - Array of topic URIs to subscribe to
 * @param onEvent - Callback when an event is received
 * @param enabled - Whether the subscription is active (default: true)
 */
export function useMercure(
  topics: string[],
  onEvent: MercureEventHandler,
  enabled = true
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || topics.length === 0) return;

    const url = new URL(MERCURE_HUB_URL);
    for (const topic of topics) {
      url.searchParams.append("topic", topic);
    }

    // Reconnect with Last-Event-ID for missed events
    if (lastEventIdRef.current) {
      url.searchParams.set("Last-Event-ID", lastEventIdRef.current);
    }

    const es = new EventSource(url.toString());

    es.onmessage = (event) => {
      if (event.lastEventId) {
        lastEventIdRef.current = event.lastEventId;
      }
      try {
        const data = JSON.parse(event.data);
        onEventRef.current(data);
      } catch {
        // ignore non-JSON events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };

    return () => {
      es.close();
    };
  }, [topics.join(","), enabled]);
}

/**
 * Hook to subscribe to provider-level events (new_request, status_change, etc.)
 */
export function useProviderMercure(
  providerId: string | null | undefined,
  onEvent: MercureEventHandler
) {
  const topics = providerId ? [`/heysummon/providers/${providerId}`] : [];
  useMercure(topics, onEvent, !!providerId);
}

/**
 * Hook to subscribe to request-level events (keys_exchanged, new_message, closed)
 */
export function useRequestMercure(
  requestId: string | null | undefined,
  onEvent: MercureEventHandler
) {
  const topics = requestId ? [`/heysummon/requests/${requestId}`] : [];
  useMercure(topics, onEvent, !!requestId);
}
