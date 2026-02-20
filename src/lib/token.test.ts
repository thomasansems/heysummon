import { describe, it, expect, vi } from "vitest";
import { createVerifyToken, verifyToken } from "./token";

describe("token", () => {
  it("creates and verifies a token", () => {
    const token = createVerifyToken("test@example.com");
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.email).toBe("test@example.com");
  });

  it("rejects tampered token", () => {
    const token = createVerifyToken("test@example.com");
    const tampered = token.slice(0, -1) + "X";
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects malformed token", () => {
    expect(verifyToken("garbage")).toBeNull();
    expect(verifyToken("a.b.c")).toBeNull();
  });

  it("rejects expired token (>24h)", () => {
    vi.useFakeTimers();
    const token = createVerifyToken("test@example.com");
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(verifyToken(token)).toBeNull();
    vi.useRealTimers();
  });
});
