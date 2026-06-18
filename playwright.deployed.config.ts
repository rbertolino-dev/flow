import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
import { E2E_AUTH_FILE } from "./tests/helpers/e2eAuthPaths";
import { loadE2eEnvSecure } from "./tests/helpers/loadE2eEnv";

/**
 * Testes contra build Docker (porta 3000), com auth segura:
 * - Credenciais só em .env.e2e.local (gitignored, chmod 600)
 * - Login uma vez → storageState em playwright/.auth/ (gitignored)
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  timeout: 300_000,
  use: {
    ...base.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
  },
  webServer: undefined,
  projects: [
    ...(loadE2eEnvSecure()
      ? [
          {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
          },
        ]
      : []),
    {
      name: "chromium-perf",
      testMatch: /funnel-(tab-switch|network-outage|diagnosis-validation|slow-network|longtask|render-profile|column-visibility|card-count-scaling|first-load-breakdown)\.perf\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(existsSync(E2E_AUTH_FILE) ? { storageState: E2E_AUTH_FILE } : {}),
      },
      ...(loadE2eEnvSecure() ? { dependencies: ["setup" as const] } : {}),
    },
    {
      name: "chromium-functional",
      testMatch: /funnel-lead-tags\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(existsSync(E2E_AUTH_FILE) ? { storageState: E2E_AUTH_FILE } : {}),
      },
      ...(loadE2eEnvSecure() ? { dependencies: ["setup" as const] } : {}),
    },
    {
      name: "chromium-unit",
      testMatch: /(funnel-(perf-diagnosis|diagnosis-validation)|broadcast-rotate-stagger)\.unit\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
