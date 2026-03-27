import { NextResponse } from "next/server";
import { validateContent, type ContentFlag } from "@/lib/content-safety";

export interface ContentSafetyResult {
  passed: true;
  flags: ContentFlag[];
  sanitizedText: string;
}

interface ContentSafetyBlocked {
  passed: false;
  response: NextResponse;
}

/**
 * Extract text content to validate from a request body.
 * Mirrors the Guard's extraction logic: question > messages[].content > plaintext
 */
function extractText(body: Record<string, unknown>): string | null {
  if (typeof body.question === "string" && body.question) {
    return body.question;
  }

  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const text = body.messages
      .map((m: Record<string, unknown>) =>
        typeof m.content === "string" ? m.content : ""
      )
      .join("\n");
    if (text) return text;
  }

  if (typeof body.plaintext === "string" && body.plaintext) {
    return body.plaintext;
  }

  return null;
}

/**
 * Run content safety checks on a request body.
 *
 * Returns { passed: true, flags, sanitizedText } if content is safe.
 * Returns { passed: false, response } with a 422 NextResponse if content is blocked.
 *
 * When content passes, the caller should apply sanitized text back to the body
 * for the relevant fields (question, plaintext, etc.).
 */
export function checkContentSafety(
  body: Record<string, unknown>
): ContentSafetyResult | ContentSafetyBlocked {
  const text = extractText(body);

  if (!text) {
    return { passed: true, flags: [], sanitizedText: "" };
  }

  const safety = validateContent(text);

  if (safety.blocked) {
    return {
      passed: false,
      response: NextResponse.json(
        {
          error: "Content blocked by safety filter",
          flags: safety.flags,
        },
        { status: 422 }
      ),
    };
  }

  return {
    passed: true,
    flags: safety.flags,
    sanitizedText: safety.sanitizedText,
  };
}

/**
 * Apply sanitized text back to the request body fields.
 * Mutates the body object in place.
 */
export function applySanitizedContent(
  body: Record<string, unknown>,
  sanitizedText: string
): void {
  if (!sanitizedText) return;

  if (typeof body.question === "string" && body.question) {
    body.question = sanitizedText;
  }
  if (typeof body.plaintext === "string" && body.plaintext) {
    body.plaintext = sanitizedText;
  }
}
