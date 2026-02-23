export interface GuardReceipt {
    /** Base64-encoded JSON receipt payload */
    token: string;
    /** Base64-encoded Ed25519 signature over the token bytes */
    signature: string;
}
export interface ReceiptPayload {
    contentHash: string;
    timestamp: number;
    nonce: string;
}
/**
 * Create a signed validation receipt using Ed25519.
 *
 * The receipt proves content passed through the Guard.
 * Platform verifies with the corresponding public key.
 */
export declare function createReceipt(sanitizedText: string): GuardReceipt;
