export interface Provider {
  name: string;
  nameLower: string;
  apiKey: string;
  providerId: string;
  providerName: string;
  addedAt: string;
}

export interface SubmitRequestOptions {
  question: string;
  messages?: Array<{ role: string; content: string }>;
  signPublicKey?: string;
  encryptPublicKey?: string;
  providerName?: string;
  requiresApproval?: boolean;
}

export interface SubmitRequestResult {
  requestId: string;
  refCode: string;
  status: string;
  expiresAt: string;
  providerUnavailable?: boolean;
  nextAvailableAt?: string;
  serverPublicKey?: string;
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
  from?: "provider" | "consumer";
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
  from: "provider" | "consumer";
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
  providerName?: string;
  provider?: { id: string; name: string };
  createdAt?: string;
  expiresAt?: string;
}

export interface HeySummonClientOptions {
  baseUrl: string;
  apiKey: string;
}

export interface WhoamiResult {
  keyId: string;
  keyName: string | null;
  provider: {
    id: string;
    name: string;
    isActive: boolean;
  };
  expert: {
    id: string;
    name: string | null;
  };
}
