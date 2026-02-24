import { isIPv4 } from "net";

/**
 * Check if an IPv4 address matches a CIDR range.
 * e.g. ipMatchesCidr("192.168.1.5", "192.168.1.0/24") → true
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixStr] = cidr.split("/");
  if (!rangeIp) return false;

  // Exact match (no prefix length)
  if (!prefixStr) return ip === rangeIp;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToInt(ip);
  const rangeNum = ipToInt(rangeIp);
  if (ipNum === null || rangeNum === null) return false;

  // Create mask from prefix length
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if an IP is allowed by a comma-separated list of CIDR/IPs.
 * Returns true if allowedIps is null/empty (no restriction).
 */
export function ipAllowed(ip: string, allowedIps: string | null | undefined): boolean {
  if (!allowedIps || allowedIps.trim() === "") return true;

  const entries = allowedIps.split(",").map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return true;

  return entries.some((entry) => ipMatchesCidr(ip, entry));
}

function ipToInt(ip: string): number | null {
  if (!isIPv4(ip)) return null;
  const parts = ip.split(".");
  return (
    ((parseInt(parts[0]) << 24) |
      (parseInt(parts[1]) << 16) |
      (parseInt(parts[2]) << 8) |
      parseInt(parts[3])) >>>
    0
  );
}
