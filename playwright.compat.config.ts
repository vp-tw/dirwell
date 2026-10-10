import { defineConfig } from "@playwright/test";

/** A bounded engine smoke suite; full regression remains in playwright.config.ts. */
export default defineConfig({
  testDir: "test/browser",
  testMatch: ["theme-contract.spec.ts", "explorer.spec.ts"],
  grep: /theme-contract.spec.ts|global IME commit/,
  timeout: 30_000,
  workers: 1,
  use: { headless: true, viewport: { width: 1280, height: 800 } },
  projects: (["chromium", "firefox", "webkit"] as const).map((name) => ({
    name,
    use: { browserName: name },
  })),
  reporter: process.env.CI ? "github" : "list",
  outputDir: ".playwright-results",
});
