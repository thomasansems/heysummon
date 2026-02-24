import { describe, it } from "node:test";
import * as assert from "node:assert";
import { generateEnv, HeysummonConfig } from "../lib/config";

describe("config", () => {
  describe("generateEnv", () => {
    const baseConfig: HeysummonConfig = {
      port: 3000,
      publicUrl: "http://localhost:3000",
      enableFormLogin: true,
      enableGithubOauth: false,
      enableGoogleOauth: false,
    };

    const secrets = {
      nextauthSecret: "abc123",
      mercureJwtSecret: "def456",
    };

    it("generates env with all required variables", () => {
      const env = generateEnv(baseConfig, secrets);

      assert.ok(env.includes("DATABASE_URL="));
      assert.ok(env.includes("PORT=3000"));
      assert.ok(env.includes('NEXTAUTH_URL="http://localhost:3000"'));
      assert.ok(env.includes('NEXTAUTH_SECRET="abc123"'));
      assert.ok(env.includes('MERCURE_JWT_SECRET="def456"'));
      assert.ok(env.includes('ENABLE_FORM_LOGIN="true"'));
    });

    it("includes GitHub OAuth when enabled", () => {
      const config: HeysummonConfig = {
        ...baseConfig,
        enableGithubOauth: true,
        githubId: "gh-id",
        githubSecret: "gh-secret",
      };
      const env = generateEnv(config, secrets);

      assert.ok(env.includes('GITHUB_ID="gh-id"'));
      assert.ok(env.includes('GITHUB_SECRET="gh-secret"'));
    });

    it("includes Google OAuth when enabled", () => {
      const config: HeysummonConfig = {
        ...baseConfig,
        enableGoogleOauth: true,
        googleId: "g-id",
        googleSecret: "g-secret",
      };
      const env = generateEnv(config, secrets);

      assert.ok(env.includes('GOOGLE_ID="g-id"'));
      assert.ok(env.includes('GOOGLE_SECRET="g-secret"'));
    });

    it("excludes OAuth vars when disabled", () => {
      const env = generateEnv(baseConfig, secrets);

      assert.ok(!env.includes("GITHUB_ID"));
      assert.ok(!env.includes("GITHUB_SECRET"));
      assert.ok(!env.includes("GOOGLE_ID"));
      assert.ok(!env.includes("GOOGLE_SECRET"));
    });

    it("uses custom port in output", () => {
      const config: HeysummonConfig = {
        ...baseConfig,
        port: 8080,
        publicUrl: "https://my.domain.com",
      };
      const env = generateEnv(config, secrets);

      assert.ok(env.includes("PORT=8080"));
      assert.ok(env.includes('NEXTAUTH_URL="https://my.domain.com"'));
    });
  });
});
