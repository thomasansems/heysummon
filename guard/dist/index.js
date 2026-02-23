"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const content_safety_1 = require("./content-safety");
const crypto_1 = require("./crypto");
const app = (0, express_1.default)();
const PLATFORM_URL = process.env.PLATFORM_URL || "http://localhost:3000";
const PORT = parseInt(process.env.PORT || "3000", 10);
/**
 * Content-submission routes that require Guard validation before proxying.
 * POST requests to these paths run through the content safety pipeline.
 */
const CONTENT_ROUTES = ["/api/v1/help", "/api/v1/message/"];
function isContentRoute(method, path) {
    if (method !== "POST")
        return false;
    return CONTENT_ROUTES.some((route) => path === route || path.startsWith(route));
}
// ── Health check (not proxied) ──
app.get("/health", (_req, res) => res.json({ ok: true }));
// ── Parse JSON for content routes only ──
app.use((req, res, next) => {
    if (isContentRoute(req.method, req.path)) {
        express_1.default.json({ limit: "1mb" })(req, res, next);
    }
    else {
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
        const text = body?.question ||
            (Array.isArray(body?.messages)
                ? body.messages
                    .map((m) => m.content || "")
                    .join("\n")
                : null) ||
            body?.plaintext;
        if (!text || typeof text !== "string") {
            // No content to validate — attach receipt for empty content and proxy
            const receipt = (0, crypto_1.createReceipt)("");
            req.headers["x-guard-receipt"] = receipt.token;
            req.headers["x-guard-receipt-sig"] = receipt.signature;
            return next();
        }
        const safety = (0, content_safety_1.validateContent)(text);
        if (safety.blocked) {
            return res.status(422).json({
                error: "Content blocked by safety filter",
                flags: safety.flags,
            });
        }
        // Content passed — create signed receipt and attach as headers
        const receipt = (0, crypto_1.createReceipt)(safety.sanitizedText);
        req.headers["x-guard-receipt"] = receipt.token;
        req.headers["x-guard-receipt-sig"] = receipt.signature;
        // If content was sanitized, update the body
        if (safety.sanitizedText !== text) {
            if (body.question) {
                body.question = safety.sanitizedText;
            }
            if (body.plaintext) {
                body.plaintext = safety.sanitizedText;
            }
            // Re-serialize body so the proxy sends the sanitized version
            const serialized = JSON.stringify(body);
            req.headers["content-length"] = Buffer.byteLength(serialized).toString();
            req._body = true;
            req.body = body;
            req._serializedBody = serialized;
        }
        next();
    }
    catch (err) {
        console.error("Guard validation error:", err);
        return res.status(500).json({ error: "Guard validation error" });
    }
});
/**
 * Reverse proxy: forward all /api/* requests to the Platform.
 * The Guard is the single entry point — Platform is not exposed externally.
 */
const proxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: PLATFORM_URL,
    changeOrigin: true,
    // For content routes where we modified the body, send our serialized version
    on: {
        proxyReq: (proxyReq, req) => {
            if (req._serializedBody) {
                proxyReq.setHeader("content-type", "application/json");
                proxyReq.setHeader("content-length", Buffer.byteLength(req._serializedBody));
                proxyReq.write(req._serializedBody);
                proxyReq.end();
            }
        },
    },
});
app.use("/api", proxy);
// ── Proxy everything else too (frontend assets, auth, etc.) ──
const catchAllProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: PLATFORM_URL,
    changeOrigin: true,
});
app.use(catchAllProxy);
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Guard reverse proxy listening on :${PORT}`);
    console.log(`Proxying to Platform at ${PLATFORM_URL}`);
});
