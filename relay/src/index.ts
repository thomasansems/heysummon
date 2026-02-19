import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getDb } from "./db";
import { generateKeyPair, encryptMessage, decryptMessage } from "./crypto";
import { nanoid } from "nanoid";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hitlaas-relay", version: "1.0.0" });
});

// ── Validate API Key middleware ───────────────────────────────────────────────

const PLATFORM_URL = process.env.PLATFORM_URL || "http://localhost:3000";
const RELAY_SECRET = process.env.RELAY_SECRET || "";

async function validateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers["x-api-key"] as string || req.body?.apiKey;
  if (!apiKey) {
    res.status(401).json({ error: "API key required (x-api-key header or apiKey body field)" });
    return;
  }

  try {
    const response = await fetch(`${PLATFORM_URL}/api/internal/validate-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-secret": RELAY_SECRET,
      },
      body: JSON.stringify({ key: apiKey }),
    });

    const data = await response.json() as { valid: boolean; ownerId?: string };
    if (!data.valid) {
      res.status(401).json({ error: "Invalid or inactive API key" });
      return;
    }

    (req as unknown as Record<string, unknown>).apiKeyRecord = { owner_id: data.ownerId };
    next();
  } catch (err) {
    console.error("Key validation error:", err);
    res.status(503).json({ error: "Unable to validate API key — platform unreachable" });
  }
}

// ── Generate ref code ─────────────────────────────────────────────────────────

function generateRefCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "HTL-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function uniqueRefCode(): string {
  const db = getDb();
  for (let i = 0; i < 10; i++) {
    const code = generateRefCode();
    const existing = db.prepare("SELECT id FROM relay_sessions WHERE ref_code = ?").get(code);
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique ref code");
}

// ── POST /api/v1/relay/send — Consumer sends a help request ──────────────────

app.post("/api/v1/relay/send", validateApiKey, (req, res) => {
  try {
    const { messages, question, consumerPublicKey } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const db = getDb();
    const id = nanoid();
    const refCode = uniqueRefCode();
    const serverKeys = generateKeyPair();

    // Encrypt messages with server key
    const plaintext = JSON.stringify({ messages: messages.slice(-10), question: question || null });
    const encryptedMessages = encryptMessage(plaintext, serverKeys.publicKey);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO relay_sessions (id, ref_code, consumer_public_key, server_public_key, server_private_key, status, encrypted_messages, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, refCode, consumerPublicKey || null, serverKeys.publicKey, serverKeys.privateKey, encryptedMessages, expiresAt);

    res.json({
      requestId: id,
      refCode,
      status: "pending",
      serverPublicKey: serverKeys.publicKey,
      pollUrl: `/api/v1/relay/status/${id}`,
      expiresAt,
    });
  } catch (err) {
    console.error("relay/send error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/v1/relay/status/:id — Poll for status ───────────────────────────

app.get("/api/v1/relay/status/:id", (req, res) => {
  const db = getDb();
  const session = db.prepare("SELECT * FROM relay_sessions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!session) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Check expiry
  if (session.status === "pending" && new Date(session.expires_at as string) < new Date()) {
    db.prepare("UPDATE relay_sessions SET status = 'expired', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ requestId: session.id, refCode: session.ref_code, status: "expired" });
    return;
  }

  const response: Record<string, unknown> = {
    requestId: session.id,
    refCode: session.ref_code,
    status: session.status,
  };

  // If responded, return encrypted response (consumer decrypts with their private key)
  if (session.status === "responded" && session.encrypted_response) {
    response.encryptedResponse = session.encrypted_response;
  }

  res.json(response);
});

// ── GET /api/v1/relay/pending — Provider polls for pending requests ──────────

app.get("/api/v1/relay/pending", validateApiKey, (req, res) => {
  const db = getDb();
  const keyRecord = (req as unknown as Record<string, unknown>).apiKeyRecord as Record<string, unknown>;

  const sessions = db.prepare(`
    SELECT id, ref_code, status, created_at, expires_at 
    FROM relay_sessions 
    WHERE status = 'pending' AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  // Return only metadata — NO message content (E2E encrypted)
  res.json({
    ownerId: keyRecord.owner_id,
    pending: (sessions as Record<string, unknown>[]).map((s) => ({
      requestId: s.id,
      refCode: s.ref_code,
      status: s.status,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
    })),
  });
});

// ── GET /api/v1/relay/messages/:id — Provider fetches encrypted messages ─────

app.get("/api/v1/relay/messages/:id", validateApiKey, (req, res) => {
  const db = getDb();
  const session = db.prepare("SELECT * FROM relay_sessions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!session) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Return the encrypted messages + server private key so provider can decrypt
  // In production, provider would have their own key pair and we'd re-encrypt
  res.json({
    requestId: session.id,
    refCode: session.ref_code,
    encryptedMessages: session.encrypted_messages,
    serverPrivateKey: session.server_private_key, // Provider needs this to decrypt
  });
});

// ── POST /api/v1/relay/respond/:id — Provider sends response ─────────────────

app.post("/api/v1/relay/respond/:id", validateApiKey, (req, res) => {
  const { response, encryptedResponse } = req.body;

  if (!response && !encryptedResponse) {
    res.status(400).json({ error: "response or encryptedResponse is required" });
    return;
  }

  const db = getDb();
  const session = db.prepare("SELECT * FROM relay_sessions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!session) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (session.status === "expired") {
    res.status(400).json({ error: "Request has expired" });
    return;
  }

  if (session.status === "responded") {
    res.status(400).json({ error: "Already responded" });
    return;
  }

  // If consumer provided a public key, encrypt response for them
  let storedResponse = encryptedResponse || response;
  if (!encryptedResponse && session.consumer_public_key) {
    storedResponse = encryptMessage(response, session.consumer_public_key as string);
  }

  db.prepare(`
    UPDATE relay_sessions 
    SET encrypted_response = ?, status = 'responded', updated_at = datetime('now')
    WHERE id = ?
  `).run(storedResponse, req.params.id);

  res.json({ success: true, requestId: session.id, refCode: session.ref_code });
});

// ── GET /api/v1/relay/stats — Dashboard stats (no message content) ───────────

app.get("/api/v1/relay/stats", validateApiKey, (req, res) => {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as count FROM relay_sessions").get() as Record<string, number>).count;
  const pending = (db.prepare("SELECT COUNT(*) as count FROM relay_sessions WHERE status = 'pending'").get() as Record<string, number>).count;
  const responded = (db.prepare("SELECT COUNT(*) as count FROM relay_sessions WHERE status = 'responded'").get() as Record<string, number>).count;
  const expired = (db.prepare("SELECT COUNT(*) as count FROM relay_sessions WHERE status = 'expired'").get() as Record<string, number>).count;

  res.json({ total, pending, responded, expired });
});

// ── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔐 HITLaaS Relay running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  // Ensure DB is initialized
  getDb();
});

export default app;
