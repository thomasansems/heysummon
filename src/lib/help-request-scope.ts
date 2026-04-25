/**
 * Canonical scope filter that excludes synthetic probe rows from every
 * dashboard / events / search / channel-adapter query that lists help
 * requests to the expert.
 *
 * Probe rows are created by `POST /api/v1/setup/verify-roundtrip` to verify
 * that a freshly-installed client can reach its expert's notification fan-out
 * (HEY-445). They must never appear in the expert's inbox, counts, or
 * analytics — funnelling every list query through this helper centralises
 * the leak-prevention guarantee.
 *
 * Usage:
 *   prisma.helpRequest.findMany({ where: { ...nonProbe(), expertId } })
 *   prisma.helpRequest.count({ where: nonProbe({ status: "expired" }) })
 */

export const NON_PROBE_FILTER = { probe: false } as const;

export function nonProbe<T extends Record<string, unknown>>(
  where?: T
): T & { probe: false } {
  return { ...(where ?? ({} as T)), probe: false };
}
