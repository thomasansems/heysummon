/**
 * HeySummon Edition — feature flag for community vs cloud features.
 *
 * Files with ".cloud." in their filename or ".cloud" in their dirname
 * are licensed under LICENSE_CLOUD.md and require a HeySummon Cloud License.
 *
 * Set HEYSUMMON_EDITION=cloud to enable cloud features.
 * Default: community (self-hosted, all core features included).
 */

export type Edition = "community" | "cloud";

export const EDITION: Edition =
  (process.env.HEYSUMMON_EDITION as Edition) || "community";

export const isCloud = (): boolean => EDITION === "cloud";
export const isCommunity = (): boolean => EDITION === "community";
