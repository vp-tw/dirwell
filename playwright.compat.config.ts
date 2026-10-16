import { defineConfig } from "@playwright/test";

/** A bounded engine smoke suite; full regression remains in playwright.config.ts. */
export default defineConfig({
  testDir: "test/browser",
  testMatch: [
    "theme-contract.spec.ts",
    "explorer.spec.ts",
    "live-search.spec.mjs",
    "ledger-layout.spec.mjs",
    "crosswave-row-boundary.spec.mjs",
  ],
  grep: /theme-contract.spec.ts|ledger-layout.spec.mjs|crosswave-row-boundary.spec.mjs|global IME commit|live archive scope/,
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
