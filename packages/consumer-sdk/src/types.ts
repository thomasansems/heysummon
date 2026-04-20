export interface Expert {
  name: string;
  nameLower: string;
  apiKey: string;
  expertId: string;
  expertName: string;
  addedAt: string;
}

export interface SubmitRequestOptions {
  question: string;
  messages?: Array<{ role: string; content: string }>;
  signPublicKey?: string;
  encryptPublicKey?: string;
  expertName?: string;
  requiresApproval?: boolean;
}

export interface SubmitRequestResult {
  requestId?: string;
  refCode?: string;
  status?: string;
  expiresAt?: string;
  serverPublicKey?: string;
  // Rejection fields (expert unavailable)
  rejected?: boolean;
  reason?: string;
  message?: string;
  nextAvailableAt?: string;
}

export interface PendingEvent {
  type:
    | "new_request"
    | "new_message"
    | "keys_exchanged"
    | "responded"
    | "closed"
    | "cancelled";
  requestId: string;
  refCode: string | null;
  from?: "expert" | "consumer";
  messageCount?: number;
  respondedAt?: string | null;
  latestMessageAt?: string | null;
  cancelledAt?: string | null;
  question?: string | null;
  requiresApproval?: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export interface Message {
  id: string;
  from: "expert" | "consumer";
  ciphertext: string;
  iv: string;
  authTag: string;
  signature: string;
  messageId: string;
  createdAt: string;
  plaintext?: string;
}

export interface RequestStatusResponse {
  requestId: string;
  refCode: string | null;
  status: string;
  response?: string;
  lastMessage?: string;
  question?: string;
  expertName?: string;
  expert?: { id: string; name: string };
  approvalDecision?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface HeySummonClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Enable E2E encryption (default: true). Set to false for plaintext mode. */
  e2e?: boolean;
  /** Override the outgoing User-Agent header on every request. */
  userAgent?: string;
  /**
   * Additional headers attached to every request. Cannot override
   * `x-api-key`; can be overridden by `userAgent` for the User-Agent slot.
   */
  extraHeaders?: Record<string, string>;
}

export interface DecryptedMessage {
  id: string;
  from: "expert" | "consumer";
  ciphertext?: string;
  iv?: string;
  authTag?: string;
  signature?: string;
  messageId: string;
  createdAt: string;
  plaintext?: string;
  decryptError?: boolean;
}

export interface MessagesResponse {
  requestId: string;
  refCode: string | null;
  status: string;
  consumerSignPubKey: string | null;
  consumerEncryptPubKey: string | null;
  expertSignPubKey: string | null;
  expertEncryptPubKey: string | null;
  messages: Message[];
  expiresAt: string;
}

export interface WhoamiResult {
  keyId: string;
  keyName: string | null;
  expert: {
    id: string;
    name: string;
    isActive: boolean;
  };
  owner: {
    id: string;
    name: string | null;
  };
}
