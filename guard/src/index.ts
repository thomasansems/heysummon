import express from "express";
import {
  createProxyMiddleware,
  type RequestHandler,
} from "http-proxy-middleware";
import { validateContent } from "./content-safety";
import { createReceipt } from "./crypto";

const app = express();
const PLATFORM_URL = process.env.PLATFORM_URL || "http://localhost:3000";
const PORT = parseInt(process.env.PORT || "3000", 10);

/**
 * Content-submission routes that require Guard validation before proxying.
 * POST requests to these paths run through the content safety pipeline.
 */
const CONTENT_ROUTES = ["/api/v1/help", "/api/v1/message/"];

function isContentRoute(method: string, path: string): boolean {
  if (method !== "POST") return false;
  return CONTENT_ROUTES.some((route) => path === route || path.startsWith(route));
}

// ── Health check (not proxied) ──
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Parse JSON for content routes only ──
app.use((req, res, next) => {
  if (isContentRoute(req.method, req.path)) {
    express.json({ limit: "1mb" })(req, res, next);
  } else {
    next();
  }
});

/**
 * Content validation middleware.
 * Runs the safety pipeline (sanitize HTML, defang URLs, detect PII) on
 * content-submission routes. Attaches a signed Ed25519 receipt header
 * that the Platform verifies before processing.
 */
app.use((req, res, next) => {
  if (!isContentRoute(req.method, req.path)) {
    return next();
  }

  try {
    // Extract text content to validate from the request body
    const body = req.body;
    const text =
      body?.question ||
      (Array.isArray(body?.messages)
        ? body.messages
            .map((m: { content?: string }) => m.content || "")
            .join("\n")
        : null) ||
      body?.plaintext;

    if (!text || typeof text !== "string") {
      // No content to validate — attach receipt for empty content and proxy
      const receipt = createReceipt("");
      req.headers["x-guard-receipt"] = receipt.token;
      req.headers["x-guard-receipt-sig"] = receipt.signature;
      // Re-serialize body since express.json() consumed the raw stream
      const serialized = JSON.stringify(body);
      req.headers["content-length"] = Buffer.byteLength(serialized).toString();
      (req as any)._body = true;
      (req as any)._serializedBody = serialized;
      return next();
    }

    const safety = validateContent(text);

    if (safety.blocked) {
      return res.status(422).json({
        error: "Content blocked by safety filter",
        flags: safety.flags,
      });
    }

    // Content passed — create signed receipt and attach as headers
    const receipt = createReceipt(safety.sanitizedText);
    req.headers["x-guard-receipt"] = receipt.token;
    req.headers["x-guard-receipt-sig"] = receipt.signature;

    // Update body if sanitized
    if (safety.sanitizedText !== text) {
      if (body.question) {
        body.question = safety.sanitizedText;
      }
      if (body.plaintext) {
        body.plaintext = safety.sanitizedText;
      }
    }

    // Always re-serialize body for proxying — express.json() consumes the
    // raw stream so http-proxy-middleware can't re-stream it
    const serialized = JSON.stringify(body);
    req.headers["content-length"] = Buffer.byteLength(serialized).toString();
    (req as any)._body = true;
    (req as any).body = body;
    (req as any)._serializedBody = serialized;

    next();
  } catch (err) {
    console.error("Guard validation error:", err);
    return res.status(500).json({ error: "Guard validation error" });
  }
});

/**
 * Reverse proxy: forward all /api/* requests to the Platform.
 * The Guard is the single entry point — Platform is not exposed externally.
 */
const proxy = createProxyMiddleware({
  target: PLATFORM_URL,
  changeOrigin: true,
  // For content routes where we modified the body, send our serialized version
  on: {
    proxyReq: (proxyReq, req: any) => {
      if (req._serializedBody) {
        proxyReq.setHeader("content-type", "application/json");
        proxyReq.setHeader(
          "content-length",
          Buffer.byteLength(req._serializedBody)
        );
        proxyReq.write(req._serializedBody);
        proxyReq.end();
      }
    },
  },
}) as RequestHandler;

app.use("/api", proxy);

// ── Proxy everything else too (frontend assets, auth, etc.) ──
const catchAllProxy = createProxyMiddleware({
  target: PLATFORM_URL,
  changeOrigin: true,
}) as RequestHandler;

app.use(catchAllProxy);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Guard reverse proxy listening on :${PORT}`);
  console.log(`Proxying to Platform at ${PLATFORM_URL}`);
});
