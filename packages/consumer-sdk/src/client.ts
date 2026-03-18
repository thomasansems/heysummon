import type {
  SubmitRequestOptions,
  SubmitRequestResult,
  PendingEvent,
  Message,
  WhoamiResult,
  HeySummonClientOptions,
} from "./types.js";

/**
 * Typed HTTP client for the HeySummon consumer API.
 * Each method is a thin wrapper around fetch that includes the x-api-key header.
 */
export class HeySummonClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: HeySummonClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, ""); // trim trailing slash
    this.apiKey = opts.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /** Identify which provider this API key is linked to */
  async whoami(): Promise<WhoamiResult> {
    return this.request<WhoamiResult>("GET", "/api/v1/whoami");
  }

  /** Submit a help request */
  async submitRequest(opts: SubmitRequestOptions): Promise<SubmitRequestResult> {
    return this.request<SubmitRequestResult>("POST", "/api/v1/help", {
      apiKey: this.apiKey,
      question: opts.question,
      messages: opts.messages,
      signPublicKey: opts.signPublicKey,
      encryptPublicKey: opts.encryptPublicKey,
      providerName: opts.providerName,
      requiresApproval: opts.requiresApproval,
    });
  }

  /** Poll for pending events (writes lastPollAt heartbeat on the server) */
  async getPendingEvents(): Promise<{ events: PendingEvent[] }> {
    return this.request<{ events: PendingEvent[] }>("GET", "/api/v1/events/pending");
  }

  /** Acknowledge a specific event */
  async ackEvent(requestId: string): Promise<void> {
    await this.request<unknown>("POST", `/api/v1/events/ack/${requestId}`, {});
  }

  /** Fetch the full message history for a request */
  async getMessages(requestId: string): Promise<{ messages: Message[] }> {
    return this.request<{ messages: Message[] }>(
      "GET",
      `/api/v1/messages/${requestId}`
    );
  }

  /** Get the current status of a help request */
  async getRequestStatus(requestId: string): Promise<{
    request: { status: string; refCode: string | null };
  }> {
    return this.request("GET", `/api/v1/help/${requestId}`);
  }
}
