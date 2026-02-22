import express from "express";
import { validateContent } from "./content-safety";
import { signContent } from "./crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * POST /validate
 *
 * Pre-flight validation endpoint. Called by the SKILL before submitting to the platform.
 * Validates content (sanitize HTML, defang URLs, detect PII) and returns a signature
 * that the platform can verify to prove the content passed through the guard.
 *
 * Flow: Skill → Guard → Skill → Platform (with signature)
 */
app.post("/validate", (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string") {
      return res.status(400).json({ error: "text must be a string" });
    }

    const safety = validateContent(text);

    if (safety.blocked) {
      return res.json({
        valid: false,
        reason: "Content blocked by safety filter",
        flags: safety.flags,
      });
    }

    const { signature, timestamp, nonce } = signContent(safety.sanitizedText);

    return res.json({
      valid: true,
      sanitizedText: safety.sanitizedText,
      signature,
      timestamp,
      nonce,
      flags: safety.flags,
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
