"use client";

import { useEffect, useRef } from "react";

export type MercureEventHandler = (data: Record<string, unknown>) => void;

/**
 * React hook for subscribing to real-time events via the platform SSE proxy.
 * Dashboard uses /api/v1/events/stream with session cookie auth,
 * or an internal SSE route that wraps Mercure.
 *
 * For dashboard (same-origin), we use /api/internal/events/stream with
 * topic query params — the server resolves the session user and subscribes
 * to Mercure internally.
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

    const url = new URL("/api/internal/events/stream", window.location.origin);
    for (const topic of topics) {
      url.searchParams.append("topic", topic);
    }

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
      // EventSource auto-reconnects
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
