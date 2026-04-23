import { z } from "zod";
import { NextResponse } from "next/server";

// ── Helpers ──

/** Reject requests whose Content-Type is not application/json */
export function requireJsonContentType(request: Request): NextResponse | null {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  return null;
}

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const isDev = process.env.NODE_ENV !== "production";
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          ...(isDev
            ? {
                details: result.error.issues.map((i) => ({
                  path: i.path.join("."),
                  message: i.message,
                })),
              }
            : {}),
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

// ── Expert schemas ──

export const expertCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).regex(
    /^[a-zA-Z0-9 _\-'.]+$/,
    "Name may only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods"
  ).transform((s) => s.trim()),
});

export const expertUpdateSchema = z.object({
  name: z.string().max(100).regex(
    /^[a-zA-Z0-9 _\-'.]+$/,
    "Name may only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods"
  ).optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  availableDays: z.string().nullable().optional(),
  digestTime: z.string().nullable().optional(),
  tagline: z.string().max(160).optional(),
  taglineEnabled: z.boolean().optional(),
  phoneFirst: z.boolean().optional(),
  phoneFirstIntegrationId: z.string().nullable().optional(),
  phoneFirstTimeout: z.number().int().min(10).max(120).optional(),
});

// ── Key schemas ──

export const apiKeyScopeEnum = z.enum(["full", "read", "write", "admin"]);

export const keyCreateSchema = z.object({
  name: z.string().nullable().optional(),
  expertId: z.string().optional(),
  scope: apiKeyScopeEnum.optional(),
  allowedIps: z.string().nullable().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
  clientChannel: z.enum(["openclaw", "claudecode", "codex", "gemini", "cursor"]).nullable().optional(),
  clientSubChannel: z.enum(["telegram", "whatsapp"]).nullable().optional(),
});

export const keyUpdateSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  scope: apiKeyScopeEnum.optional(),
  allowedIps: z.string().nullable().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
  clientChannel: z.enum(["openclaw", "claudecode", "codex", "gemini", "cursor"]).nullable().optional(),
  clientSubChannel: z.enum(["telegram", "whatsapp"]).nullable().optional(),
});

// ── Request PATCH schema ──

export const requestPatchSchema = z.object({
  response: z.string().min(1, "response is required"),
});

// ── V1 Help schema ──

export const helpCreateSchema = z.object({
  apiKey: z.string().min(1, "apiKey is required").max(512),
  signPublicKey: z.string().max(2048).optional(),
  encryptPublicKey: z.string().max(2048).optional(),
  publicKey: z.string().max(4096).optional(),
  messages: z.array(z.any()).max(200).optional(),
  question: z.string().max(50_000).optional(),
  questionPreview: z.string().max(500).optional(),
  requiresApproval: z.boolean().optional(),
  responseRequired: z.boolean().optional().default(true),
  messageCount: z.number().int().min(0).max(1000).optional(),
});

// ── V1 Key Exchange schema ──

export const keyExchangeSchema = z.object({
  signPublicKey: z.string().min(1, "signPublicKey is required"),
  encryptPublicKey: z.string().min(1, "encryptPublicKey is required"),
});

// ── V1 Message schema ──

export const messageCreateSchema = z.object({
  from: z.enum(["consumer", "expert"], { message: "from must be consumer or expert" }),
  plaintext: z.string().max(100_000).optional(),
  ciphertext: z.string().max(200_000).optional(),
  iv: z.string().max(512).optional(),
  authTag: z.string().max(512).optional(),
  signature: z.string().max(2048).optional(),
  messageId: z.string().max(256).optional(),
});

// ── Channel schemas ──

export const channelCreateSchema = z.object({
  profileId: z.string().min(1, "profileId is required"),
  type: z.enum(["openclaw", "telegram", "slack"], { message: "type must be openclaw, telegram, or slack" }),
  name: z.string().min(1, "Name is required").transform((s) => s.trim()),
  config: z.record(z.string(), z.any()).default({}),
});

export const channelUpdateSchema = z.object({
  name: z.string().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

// ── Certificate schemas (cloud-only) ──

export const certificateCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).transform((s) => s.trim()),
  validityDays: z.number().int().min(1).max(3650).optional(),
});

// ── HITL Protocol: Rating ──

export const ratingCreateSchema = z.object({
  rating: z.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
  feedback: z.string().max(2000).optional(),
});
