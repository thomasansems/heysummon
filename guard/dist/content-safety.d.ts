export interface ContentFlag {
    type: "xss" | "url" | "credit_card" | "phone" | "email" | "ssn_bsn";
    original: string;
    replacement: string;
}
export interface SafetyResult {
    sanitizedText: string;
    flags: ContentFlag[];
    blocked: boolean;
}
/**
 * Strip HTML/XSS using DOMPurify + jsdom
 */
export declare function sanitizeHtml(text: string): {
    text: string;
    flags: ContentFlag[];
};
/**
 * Defang URLs: https → hxxps, dots in domain → [.]
 */
export declare function defangUrls(text: string): {
    text: string;
    flags: ContentFlag[];
};
/**
 * Detect PII: credit cards, phone numbers, emails, SSN/BSN
 */
export declare function detectPii(text: string): {
    text: string;
    flags: ContentFlag[];
};
/**
 * Run full content safety pipeline
 */
export declare function validateContent(text: string): SafetyResult;
