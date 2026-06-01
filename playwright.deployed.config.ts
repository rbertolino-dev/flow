import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Testes contra build Docker em produção local (blue/green).
 * Não sobe `npm run dev` — usa container na porta 3000.
 *
 * Uso: npm run test:e2e:funnel-perf:deployed
 */
export default defineConfig({
  ...base,
  use: {
    ...base.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
  },
  webServer: undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
