export interface GuardFlag {
  type: string;
  original: string;
  replacement: string;
}

export interface GuardResult {
  encryptedPayload: string;
  validationToken: string;
  timestamp: number;
  nonce: string;
  flags: GuardFlag[];
  blocked: boolean;
  sanitizedText: string;
}

const GUARD_URL = process.env.GUARD_URL || "";

/**
 * Call the guard service to validate content.
 * Returns null if guard is not configured (backward compat).
 */
export async function validateContent(
  text: string
): Promise<GuardResult | null> {
  if (!GUARD_URL) {
    return null; // Guard disabled — backward compatible
  }

  try {
    const res = await fetch(`${GUARD_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`Guard service returned ${res.status}`);
      return null; // Fail open
    }

    return (await res.json()) as GuardResult;
  } catch (err) {
    console.warn("Guard service unavailable, allowing through:", err);
    return null; // Fail open
  }
}
