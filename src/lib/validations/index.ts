import { z } from "zod";
import { NextResponse } from "next/server";

// ── Helpers ──

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

// ── Auth schemas ──

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

// ── Settings schemas ──

export const settingsUpdateSchema = z.object({
  expertise: z.string().nullable().optional(),
  notificationPref: z.enum(["email", "telegram", "none"]).optional(),
  telegramChatId: z.string().nullable().optional(),
});

// ── Provider schemas ──

export const providerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").transform((s) => s.trim()),
});

export const providerUpdateSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ── Key schemas ──

export const keyCreateSchema = z.object({
  name: z.string().nullable().optional(),
  providerId: z.string().optional(),
});

export const keyUpdateSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ── Relay schemas ──

export const relayRespondSchema = z.object({
  requestId: z.string().min(1, "requestId is required"),
  response: z.string().min(1, "response is required"),
});

export const relaySendSchema = z.object({
  requestId: z.string().min(1, "requestId is required"),
  message: z.string().min(1, "message is required"),
  senderPublicKey: z.string().optional(),
});

// ── Request PATCH schema ──

export const requestPatchSchema = z.object({
  response: z.string().min(1, "response is required"),
});

// ── V1 Help schema ──

export const helpCreateSchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
  signPublicKey: z.string().optional(),
  encryptPublicKey: z.string().optional(),
  publicKey: z.string().optional(),
  messages: z.array(z.any()).optional(),
  question: z.string().optional(),
  messageCount: z.number().int().min(0).optional(),
});

// ── V1 Key Exchange schema ──

export const keyExchangeSchema = z.object({
  signPublicKey: z.string().min(1, "signPublicKey is required"),
  encryptPublicKey: z.string().min(1, "encryptPublicKey is required"),
});

// ── V1 Message schema ──

export const messageCreateSchema = z.object({
  from: z.enum(["consumer", "provider"], { message: "from must be consumer or provider" }),
  plaintext: z.string().optional(),
  ciphertext: z.string().optional(),
  iv: z.string().optional(),
  authTag: z.string().optional(),
  signature: z.string().optional(),
  messageId: z.string().optional(),
});
