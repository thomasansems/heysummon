import { describe, it, expect } from "vitest";
import { buildSetupCopyText } from "@/lib/setup-copy-text";
import { buildInstallCommand, type ClientChannel, PLATFORM_META } from "@/lib/setup-command";

// Derive from PLATFORM_META so the snapshot guard automatically covers any
// new channel a developer adds — silently skipping a channel here would defeat
// the point of the drift test. `custom` is included; it produces a different
// (HTTP-only) install shape, but locking it down is still useful.
// Sorted for deterministic snapshot ordering across runs.
const CHANNELS: ClientChannel[] = (Object.keys(PLATFORM_META) as ClientChannel[]).sort();

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
