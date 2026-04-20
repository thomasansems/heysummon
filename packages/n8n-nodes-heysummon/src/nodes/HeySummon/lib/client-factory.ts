import { HeySummonClient } from "@heysummon/consumer-sdk";
import { getUserAgent } from "./user-agent";

export interface CredentialFields {
  apiKey: string;
  baseUrl: string;
  e2eEnabled?: boolean;
}

/**
 * Build a HeySummonClient that always tags outbound calls with the n8n
 * User-Agent (PRD §4.8). E2E follows the credential default (true unless
 * explicitly disabled).
 */
export function buildClient(creds: CredentialFields): HeySummonClient {
  return new HeySummonClient({
    apiKey: creds.apiKey,
    baseUrl: creds.baseUrl,
    e2e: creds.e2eEnabled !== false,
    userAgent: getUserAgent(),
  });
}
