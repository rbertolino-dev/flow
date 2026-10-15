import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
import { E2E_AUTH_FILE } from "./tests/helpers/e2eAuthPaths";
import { loadE2eEnvSecure } from "./tests/helpers/loadE2eEnv";

/** Config temporária para validar operação de campo OS no Docker (porta 3000). */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  timeout: 300_000,
  workers: 1,
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
      name: "chromium-os-field",
      testMatch: /service-orders-field\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(existsSync(E2E_AUTH_FILE) ? { storageState: E2E_AUTH_FILE } : {}),
      },
      ...(loadE2eEnvSecure() ? { dependencies: ["setup" as const] } : {}),
    },
    {
      name: "unit",
      testMatch: /service-order-(field|management|finance)\.unit\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
