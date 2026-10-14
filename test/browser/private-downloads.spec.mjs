import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";
import { createPrivateDownloads } from "../../examples/private-downloads/handler.mjs";
import { withApplicationBranding } from "../../examples/private-downloads/branding.mjs";
import { startPrivateDownloads } from "../../examples/private-downloads/bridge.mjs";

for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: private surfaces, fresh CSP nonce, directory navigation and revoked SSE`, async ({
    page,
    context,
  }) => {
    const fixture = await mkdtemp(path.join(tmpdir(), "dirwell-private-"));
    let server, reader;
    try {
      const root = path.join(fixture, "approved"),
        folder = "docs #50% Á";
      await mkdir(path.join(root, folder), { recursive: true });
      await mkdir(path.join(fixture, "private"));
      await writeFile(path.join(fixture, "private/hidden-secret.txt"), "private bytes");
      await writeFile(path.join(root, "release.txt"), "public bytes");
      await writeFile(path.join(root, folder, "note.txt"), "note");
      await symlink("../private/hidden-secret.txt", path.join(root, "external-link"));
      const sessions = new Map([
        ["synthetic-session", { canDownload: true, expiresAt: Date.now() + 60000 }],
      ]);
      sessions.set("expired-session", { canDownload: true, expiresAt: Date.now() - 1 });
      const handler = await createPrivateDownloads({
        root,
        theme: withApplicationBranding(
          creator(
            name === "ledger"
              ? { archiveSearch: false }
              : { gamepad: false, backgroundMotion: false },
          ),
        ),
        intervalMs: 50,
        exclude: ["external-link"],
        getSession: async (request) =>
          sessions.get(request.headers.get("cookie")?.match(/host_session=([^;]+)/)?.[1]) ?? null,
      });
      server = await startPrivateDownloads(handler);
      const paths = [
        "/browse/",
        "/listing",
        "/__dirwell/listing/manifest",
        "/__dirwell/listing/block",
        "/__dirwell/page",
        "/__dirwell/asset?name=client.js",
        "/files/release.txt",
        "/__dirwell/updates",
      ];
      for (const route of paths) {
        const response = await fetch(server.url + "/downloads" + route, {
          headers: { range: "bytes=0-2", "if-none-match": "anything" },
        });
        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(await response.text()).not.toMatch(/release\.txt|hidden-secret|private bytes/);
      }
      for (const route of paths) {
        const response = await fetch(server.url + "/downloads" + route, {
          headers: { cookie: "host_session=expired-session" },
        });
        expect(response.status).toBe(401);
        expect(await response.text()).not.toMatch(/release\.txt|hidden-secret/);
      }
      const cookie = "host_session=synthetic-session";
      const file = await fetch(server.url + "/downloads/files/release.txt", {
        headers: { cookie, range: "bytes=0-2" },
      });
      expect(file.status).toBe(206);
      expect(await file.text()).toBe("pub");
      const etag = file.headers.get("etag");
      for (const route of [
        "/downloads/files/external-link",
        "/downloads/files/../private/hidden-secret.txt",
        "/downloads/listing?path=../private",
      ]) {
        const response = await fetch(server.url + route, { headers: { cookie } });
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain("private bytes");
      }
      const listing = await fetch(server.url + "/downloads/listing", { headers: { cookie } });
      expect(await listing.text()).not.toContain("hidden-secret");
      await context.addCookies([
        {
          name: "host_session",
          value: "synthetic-session",
          url: server.url,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__violations = [];
        document.addEventListener("securitypolicyviolation", (event) =>
          window.__violations.push(event.effectiveDirective),
        );
      });
      const document = await page.goto(server.url + "/downloads/browse/"),
        policy = document.headers()["content-security-policy"];
      expect(policy).toContain("'strict-dynamic'");
      expect(policy).not.toContain("'unsafe-eval'");
      const search = page.getByRole("searchbox").first(),
        rows = page.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]");
      await expect(search).toBeEnabled();
      await expect(page.locator('meta[name="application-name"]')).toHaveAttribute(
        "content",
        "Approved downloads",
      );
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--application-accent")
              .trim(),
          ),
        )
        .toBe("#174ea6");
      await search.fill("release");
      await expect(rows).toHaveCount(1);
      await search.fill("");
      await rows.filter({ hasText: "docs" }).getByRole("link").first().click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("note.txt");
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--application-accent")
              .trim(),
          ),
        )
        .toBe("#174ea6");
      await page.goBack();
      await expect(rows).toHaveCount(2);
      await writeFile(path.join(root, "arrived.txt"), "arrived");
      await expect(rows).toHaveCount(3);
      expect(await page.evaluate(() => window.__violations)).toEqual([]);
      await page.evaluate(() => (window.__documentLifetime = "same document"));
      const reconnect = page.waitForRequest((request) =>
        request.url().includes("/__dirwell/updates"),
      );
      server.disconnectClients();
      await reconnect;
      await writeFile(path.join(root, "reconnected.txt"), "after disconnect");
      await expect(rows).toHaveCount(4);
      expect(await page.evaluate(() => window.__documentLifetime)).toBe("same document");
      expect(errors).toEqual([]);
      const reloaded = await page.reload();
      expect(reloaded.headers()["content-security-policy"]).not.toBe(policy);
      await expect(search).toBeEnabled();
      const updates = await fetch(server.url + "/downloads/__dirwell/updates", {
        headers: { cookie },
      });
      expect(updates.status).toBe(200);
      reader = updates.body.getReader();
      await reader.read();
      sessions.delete("synthetic-session");
      await expect.poll(async () => (await reader.read()).done, { timeout: 3000 }).toBe(true);
      reader = null;
      const denied = await fetch(server.url + "/downloads/files/release.txt", {
        headers: { cookie, range: "bytes=0-2", "if-none-match": etag },
      });
      expect(denied.status).toBe(401);
      const deniedHead = await fetch(server.url + "/downloads/browse/", {
        method: "HEAD",
        headers: { cookie },
      });
      expect(deniedHead.status).toBe(401);
      await page.evaluate(() => {
        const button = document.createElement("button");
        button.setAttribute("onclick", "window.__untrustedHandlerRan = true");
        document.body.append(button);
        button.click();
        button.remove();
      });
      expect(await page.evaluate(() => window.__untrustedHandlerRan)).toBeUndefined();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.__violations.some((directive) => directive.startsWith("script-src")),
          ),
        )
        .toBe(true);
      await page.goto("about:blank");
    } finally {
      await reader?.cancel();
      await server?.close();
      await rm(fixture, { recursive: true, force: true });
    }
  });
}
