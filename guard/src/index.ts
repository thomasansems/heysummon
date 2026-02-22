import express from "express";
import { validateContent } from "./content-safety";
import { encryptAndSign } from "./crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/validate", (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "content must be a string" });
    }

    const safety = validateContent(content);
    const { encryptedPayload, validationToken, timestamp, nonce } =
      encryptAndSign(safety.sanitizedText);

    return res.json({
      encryptedPayload,
      validationToken,
      timestamp,
      nonce,
      flags: safety.flags,
      blocked: safety.blocked,
      sanitizedText: safety.sanitizedText,
    });
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(500).json({ error: "Internal guard error" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = parseInt(process.env.PORT || "3457", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Guard service listening on port ${PORT}`);
});
