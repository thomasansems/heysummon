import { describe, it, expect } from "vitest";
import { buildSetupCopyText } from "@/lib/setup-copy-text";
import { buildInstallCommand, type ClientChannel, PLATFORM_META } from "@/lib/setup-command";

// All channels in PLATFORM_META. `custom` produces a different (HTTP-only)
// install shape — including it keeps drift detection honest as new channels
// land. Spec called for 5 channels (HEY-442 was authored before `custom`);
// matrix size is 6 × 2 × 2 = 24.
const CHANNELS: ClientChannel[] = ["openclaw", "claudecode", "codex", "gemini", "cursor", "custom"];

const SUMMON_CONTEXTS: Array<{ key: "noContext" | "withContext"; value: string }> = [
  { key: "noContext", value: "" },
  { key: "withContext", value: "Only summon when stuck or need approval." },
];

const GLOBAL_INSTALLS: Array<{ key: "local" | "global"; value: boolean }> = [
  { key: "local", value: false },
  { key: "global", value: true },
];

const FIXED_SETUP_URL = "https://example.heysummon.test/setup/st_FIXED_TOKEN";
const FIXED_BASE_URL = "https://example.heysummon.test";
const FIXED_API_KEY = "hs_cli_FIXED_API_KEY";
const FIXED_EXPERT = "ExampleExpert";

describe("setup copy / install command — drift snapshots", () => {
  for (const channel of CHANNELS) {
    for (const ctx of SUMMON_CONTEXTS) {
      for (const gi of GLOBAL_INSTALLS) {
        it(`${channel} / ${ctx.key} / ${gi.key}`, () => {
          const copyText = buildSetupCopyText(FIXED_SETUP_URL, ctx.value, channel);
          const installCommand = buildInstallCommand({
            channel,
            skillDir: PLATFORM_META[channel].skillDir,
            baseUrl: FIXED_BASE_URL,
            apiKey: FIXED_API_KEY,
            timeout: 900,
            pollInterval: 3,
            timeoutFallback: "proceed_cautiously",
            globalInstall: gi.value,
            expertName: FIXED_EXPERT,
            summonContext: ctx.value || null,
          });

          expect({ copyText, installCommand }).toMatchSnapshot();
        });
      }
    }
  }
});
