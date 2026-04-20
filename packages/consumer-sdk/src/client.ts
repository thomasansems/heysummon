import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  SubmitRequestOptions,
  SubmitRequestResult,
  PendingEvent,
  Message,
  DecryptedMessage,
  MessagesResponse,
  WhoamiResult,
  HeySummonClientOptions,
  RequestStatusResponse,
} from "./types.js";
import type { KeyMaterial } from "./crypto.js";
import {
  generateKeyMaterial,
  encryptWithKeys,
  decryptWithKeys,
  publicKeyFromHex,
} from "./crypto.js";

/** HTTP error with status code for callers to inspect */
export class HeySummonHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(`HTTP ${status}: ${statusText} — ${body}`);
    this.name = "HeySummonHttpError";
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404;
  }
}

/**
 * Typed HTTP client for the HeySummon consumer API.
 * Each method is a thin wrapper around fetch that includes the x-api-key header.
 */
export class HeySummonClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly e2e: boolean;
  private readonly userAgent?: string;
  private readonly extraHeaders?: Record<string, string>;
  private readonly keyStore: Map<string, KeyMaterial> = new Map();
  private readonly providerKeyCache: Map<string, { encPub: string; signPub: string }> = new Map();

  constructor(opts: HeySummonClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, ""); // trim trailing slash
    this.apiKey = opts.apiKey;
    this.e2e = opts.e2e !== false; // default true
    this.userAgent = opts.userAgent;
    this.extraHeaders = opts.extraHeaders;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.extraHeaders) {
      for (const [k, v] of Object.entries(this.extraHeaders)) {
        headers[k] = v;
      }
    }
    if (this.userAgent) {
      headers["User-Agent"] = this.userAgent;
    }
    // x-api-key is set last so callers cannot override authentication via extraHeaders.
    headers["x-api-key"] = this.apiKey;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new HeySummonHttpError(res.status, res.statusText, text);
    }

    return res.json() as Promise<T>;
  }

  /** Identify which expert this API key is linked to */
  async whoami(): Promise<WhoamiResult> {
    return this.request<WhoamiResult>("GET", "/api/v1/whoami");
  }

  /** Submit a help request (auto-generates E2E keys unless consumer provides their own or e2e is disabled) */
  async submitRequest(opts: SubmitRequestOptions): Promise<SubmitRequestResult> {
    let signPublicKey = opts.signPublicKey;
    let encryptPublicKey = opts.encryptPublicKey;

    const consumerProvidedKeys = !!(opts.signPublicKey && opts.encryptPublicKey);
    const shouldAutoKeygen = this.e2e && !consumerProvidedKeys;

    let keys: KeyMaterial | undefined;
    if (shouldAutoKeygen) {
      keys = generateKeyMaterial();
      signPublicKey = keys.signPublicKey;
      encryptPublicKey = keys.encryptPublicKey;
    }

    const result = await this.request<SubmitRequestResult>("POST", "/api/v1/help", {
      apiKey: this.apiKey,
      question: opts.question,
      messages: opts.messages,
      signPublicKey,
      encryptPublicKey,
      expertName: opts.expertName,
      requiresApproval: opts.requiresApproval,
    });

    if (keys && result.requestId) {
      this.keyStore.set(result.requestId, keys);
    }

    return result;
  }

  /** Poll for pending events (writes lastPollAt heartbeat on the server) */
  async getPendingEvents(): Promise<{ events: PendingEvent[] }> {
    return this.request<{ events: PendingEvent[] }>("GET", "/api/v1/events/pending");
  }

  /** Acknowledge a specific event */
  async ackEvent(requestId: string): Promise<void> {
    await this.request<unknown>("POST", `/api/v1/events/ack/${requestId}`, {});
  }

  /** Fetch the full message history for a request (auto-decrypts when keys are available) */
  async getMessages(requestId: string): Promise<{ messages: DecryptedMessage[] }> {
    const res = await this.request<MessagesResponse>(
      "GET",
      `/api/v1/messages/${requestId}`
    );

    const keys = this.keyStore.get(requestId);
    const hasExpertKeys = !!(res.expertEncryptPubKey && res.expertSignPubKey);

    // Cache expert public keys for sendMessage() to avoid N+1 fetches
    if (hasExpertKeys) {
      this.providerKeyCache.set(requestId, {
        encPub: res.expertEncryptPubKey!,
        signPub: res.expertSignPubKey!,
      });
    }

    const messages: DecryptedMessage[] = res.messages.map((msg) => {
      // Plaintext messages: return as-is
      if (msg.iv === "plaintext" || msg.plaintext) {
        return {
          id: msg.id,
          from: msg.from,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          plaintext: msg.plaintext ?? Buffer.from(msg.ciphertext, "base64").toString("utf8"),
        };
      }

      // No keys available for decryption: return raw message
      if (!keys || !hasExpertKeys) {
        return {
          id: msg.id,
          from: msg.from,
          ciphertext: msg.ciphertext,
          iv: msg.iv,
          authTag: msg.authTag,
          signature: msg.signature,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
        };
      }

      // Auto-decrypt with stored keys
      try {
        // Always use expert's key for DH shared secret — DH is symmetric:
        // DH(consumer_priv, expert_pub) = DH(expert_priv, consumer_pub)
        const senderEncPub = publicKeyFromHex(res.expertEncryptPubKey!, "x25519");
        // Only vary the signing key for signature verification
        const senderSignPub = msg.from === "expert"
          ? publicKeyFromHex(res.expertSignPubKey!, "ed25519")
          : publicKeyFromHex(res.consumerSignPubKey!, "ed25519");

        const plaintext = decryptWithKeys(
          {
            ciphertext: msg.ciphertext,
            iv: msg.iv,
            authTag: msg.authTag,
            signature: msg.signature,
            messageId: msg.messageId,
          },
          senderEncPub,
          senderSignPub,
          keys.encryptKeyPair.privateKey
        );

        return {
          id: msg.id,
          from: msg.from,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          plaintext,
        };
      } catch {
        return {
          id: msg.id,
          from: msg.from,
          ciphertext: msg.ciphertext,
          iv: msg.iv,
          authTag: msg.authTag,
          signature: msg.signature,
          messageId: msg.messageId,
          createdAt: msg.createdAt,
          decryptError: true,
        };
      }
    });

    return { messages };
  }

  /** Get the current status of a help request */
  async getRequestStatus(
    requestId: string
  ): Promise<RequestStatusResponse> {
    return this.request<RequestStatusResponse>(
      "GET",
      `/api/v1/help/${requestId}`
    );
  }

  /** Look up a request by its ref code */
  async getRequestByRef(
    refCode: string
  ): Promise<RequestStatusResponse> {
    return this.request<RequestStatusResponse>(
      "GET",
      `/api/v1/requests/by-ref/${refCode}`
    );
  }

  /** Report that the client's blocking poll timed out */
  async reportTimeout(requestId: string): Promise<void> {
    await this.request<unknown>("POST", `/api/v1/help/${requestId}/timeout`, {});
  }

  /** Send an encrypted message to the expert (falls back to plaintext if no keys) */
  async sendMessage(
    requestId: string,
    text: string
  ): Promise<{ success: boolean; messageId: string; createdAt: string }> {
    const keys = this.keyStore.get(requestId);

    if (!keys) {
      // No local keys: send as plaintext (content-safety checked server-side)
      return this.request("POST", `/api/v1/message/${requestId}`, {
        from: "consumer",
        plaintext: text,
      });
    }

    // Use cached expert keys to avoid N+1 API calls; fetch only on cache miss
    let cached = this.providerKeyCache.get(requestId);
    if (!cached) {
      const res = await this.request<MessagesResponse>(
        "GET",
        `/api/v1/messages/${requestId}`
      );
      if (res.expertEncryptPubKey && res.expertSignPubKey) {
        cached = { encPub: res.expertEncryptPubKey, signPub: res.expertSignPubKey };
        this.providerKeyCache.set(requestId, cached);
      }
    }

    if (!cached) {
      throw new Error(
        "Cannot send encrypted message: expert has not completed key exchange yet"
      );
    }

    const expertEncPub = publicKeyFromHex(cached.encPub, "x25519");

    const payload = encryptWithKeys(
      text,
      expertEncPub,
      keys.signKeyPair.privateKey,
      keys.encryptKeyPair.privateKey
    );

    return this.request("POST", `/api/v1/message/${requestId}`, {
      from: "consumer",
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      authTag: payload.authTag,
      signature: payload.signature,
      messageId: payload.messageId,
    });
  }

  /** Remove keys from the store for a completed/closed request */
  releaseKeys(requestId: string): void {
    this.keyStore.delete(requestId);
    this.providerKeyCache.delete(requestId);
  }

  /** Import persistent keys from PEM files into the key store for a given request */
  importKeys(requestId: string, keyDir: string): void {
    const signPubPem = fs.readFileSync(path.join(keyDir, "sign_public.pem"), "utf8");
    const signPrivPem = fs.readFileSync(path.join(keyDir, "sign_private.pem"), "utf8");
    const encPubPem = fs.readFileSync(path.join(keyDir, "encrypt_public.pem"), "utf8");
    const encPrivPem = fs.readFileSync(path.join(keyDir, "encrypt_private.pem"), "utf8");

    const signPublicKey = crypto
      .createPublicKey(signPubPem)
      .export({ type: "spki", format: "der" })
      .toString("hex");
    const encryptPublicKey = crypto
      .createPublicKey(encPubPem)
      .export({ type: "spki", format: "der" })
      .toString("hex");

    const keys: KeyMaterial = {
      signPublicKey,
      encryptPublicKey,
      signKeyPair: {
        publicKey: crypto.createPublicKey(signPubPem),
        privateKey: crypto.createPrivateKey(signPrivPem),
      },
      encryptKeyPair: {
        publicKey: crypto.createPublicKey(encPubPem),
        privateKey: crypto.createPrivateKey(encPrivPem),
      },
    };

    this.keyStore.set(requestId, keys);
  }
}
