"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const content_safety_1 = require("./content-safety");
const crypto_1 = require("./crypto");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "1mb" }));
app.post("/validate", (req, res) => {
    try {
        const { content } = req.body;
        if (typeof content !== "string") {
            return res.status(400).json({ error: "content must be a string" });
        }
        const safety = (0, content_safety_1.validateContent)(content);
        const { encryptedPayload, validationToken, timestamp, nonce } = (0, crypto_1.encryptAndSign)(safety.sanitizedText);
        return res.json({
            encryptedPayload,
            validationToken,
            timestamp,
            nonce,
            flags: safety.flags,
            blocked: safety.blocked,
            sanitizedText: safety.sanitizedText,
        });
    }
    catch (err) {
        console.error("Validation error:", err);
        return res.status(500).json({ error: "Internal guard error" });
    }
});
app.get("/health", (_req, res) => res.json({ ok: true }));
const PORT = parseInt(process.env.PORT || "3457", 10);
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Guard service listening on port ${PORT}`);
});
