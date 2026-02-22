import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import LinkifyIt from "linkify-it";

const linkify = new LinkifyIt();

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
export function sanitizeHtml(text: string): { text: string; flags: ContentFlag[] } {
  const window = new JSDOM("").window;
  const purify = DOMPurify(window as any);
  const clean = purify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  const flags: ContentFlag[] = [];
  if (clean !== text) {
    flags.push({ type: "xss", original: text, replacement: clean });
  }
  return { text: clean, flags };
}

/**
 * Defang URLs: https → hxxps, dots in domain → [.]
 */
export function defangUrls(text: string): { text: string; flags: ContentFlag[] } {
  const flags: ContentFlag[] = [];
  const matches = linkify.match(text);
  if (!matches) return { text, flags };

  let result = text;
  // Process in reverse to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const original = m.raw;
    let defanged = original
      .replace(/^https:\/\//i, "hxxps://")
      .replace(/^http:\/\//i, "hxxp://");
    // Defang dots in the domain part
    const protocolEnd = defanged.indexOf("://");
    if (protocolEnd !== -1) {
      const afterProtocol = defanged.substring(protocolEnd + 3);
      const pathStart = afterProtocol.indexOf("/");
      const domain = pathStart === -1 ? afterProtocol : afterProtocol.substring(0, pathStart);
      const rest = pathStart === -1 ? "" : afterProtocol.substring(pathStart);
      const defangedDomain = domain.replace(/\./g, "[.]");
      defanged = defanged.substring(0, protocolEnd + 3) + defangedDomain + rest;
    } else {
      // No protocol, just defang dots in domain
      const pathStart = defanged.indexOf("/");
      const domain = pathStart === -1 ? defanged : defanged.substring(0, pathStart);
      const rest = pathStart === -1 ? "" : defanged.substring(pathStart);
      defanged = domain.replace(/\./g, "[.]") + rest;
    }

    flags.push({ type: "url", original, replacement: defanged });
    result = result.substring(0, m.index) + defanged + result.substring(m.lastIndex);
  }

  return { text: result, flags };
}

/**
 * Luhn check for credit card validation
 */
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Detect PII: credit cards, phone numbers, emails, SSN/BSN
 */
export function detectPii(text: string): { text: string; flags: ContentFlag[] } {
  const flags: ContentFlag[] = [];
  let result = text;

  // Credit cards (13-19 digits, possibly with spaces/dashes)
  const ccRegex = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7})\b/g;
  result = result.replace(ccRegex, (match) => {
    const digits = match.replace(/[\s-]/g, "");
    if (luhnCheck(digits)) {
      const replacement = "[REDACTED CC]";
      flags.push({ type: "credit_card", original: match, replacement });
      return replacement;
    }
    return match;
  });

  // Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  result = result.replace(emailRegex, (match) => {
    const replacement = "[REDACTED EMAIL]";
    flags.push({ type: "email", original: match, replacement });
    return replacement;
  });

  // Phone numbers (international and local formats)
  const phoneRegex = /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
  result = result.replace(phoneRegex, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      const replacement = "[REDACTED PHONE]";
      flags.push({ type: "phone", original: match, replacement });
      return replacement;
    }
    return match;
  });

  // SSN (US) pattern: XXX-XX-XXXX
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  result = result.replace(ssnRegex, (match) => {
    const replacement = "[REDACTED SSN]";
    flags.push({ type: "ssn_bsn", original: match, replacement });
    return replacement;
  });

  // BSN (NL) pattern: 9 digits
  const bsnRegex = /\b\d{9}\b/g;
  result = result.replace(bsnRegex, (match) => {
    // Simple 11-check for BSN
    const digits = match.split("").map(Number);
    const sum =
      digits[0] * 9 +
      digits[1] * 8 +
      digits[2] * 7 +
      digits[3] * 6 +
      digits[4] * 5 +
      digits[5] * 4 +
      digits[6] * 3 +
      digits[7] * 2 +
      digits[8] * -1;
    if (sum % 11 === 0 && sum !== 0) {
      const replacement = "[REDACTED BSN]";
      flags.push({ type: "ssn_bsn", original: match, replacement });
      return replacement;
    }
    return match;
  });

  return { text: result, flags };
}

/**
 * Run full content safety pipeline
 */
export function validateContent(text: string): SafetyResult {
  // Step 1: Sanitize HTML/XSS
  const html = sanitizeHtml(text);
  // Step 2: Defang URLs
  const urls = defangUrls(html.text);
  // Step 3: Detect PII
  const pii = detectPii(urls.text);

  const allFlags = [...html.flags, ...urls.flags, ...pii.flags];

  // Block if credit cards or SSN/BSN detected
  const blocked = pii.flags.some(
    (f) => f.type === "credit_card" || f.type === "ssn_bsn"
  );

  return {
    sanitizedText: pii.text,
    flags: allFlags,
    blocked,
  };
}
