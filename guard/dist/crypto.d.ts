export interface SignedResult {
    signature: string;
    timestamp: number;
    nonce: string;
}
export declare function signContent(sanitizedText: string): SignedResult;
