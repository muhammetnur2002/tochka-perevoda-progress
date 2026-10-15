import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-дымовой прогон (tests/e2e/smoke.spec.ts).
 * Без PLAYWRIGHT_BASE_URL сам поднимает `pnpm dev` (демо-режим без БД достаточно
 * для публичной части). Полный сценарий: E2E_FULL=1 + Supabase + pnpm db:seed.
 * Первый запуск: pnpm exec playwright install chromium
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
