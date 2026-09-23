import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  timeout: 20_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: process.env.CI ? "github" : "list",
  outputDir: ".playwright-results",
});
