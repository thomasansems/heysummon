export interface EncryptedResult {
    encryptedPayload: string;
    validationToken: string;
    timestamp: number;
    nonce: string;
}
/**
 * Encrypt content with AES-256-GCM and generate HMAC validation token
 */
export declare function encryptAndSign(sanitizedText: string): EncryptedResult;
