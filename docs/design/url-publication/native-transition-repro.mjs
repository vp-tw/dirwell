import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const require = createRequire(fileURLToPath(new URL("../../../package.json", import.meta.url)));
const { chromium } = require("@playwright/test");
const observations = [];
for (const guarded of [false, true, false]) {
  const css =
    (guarded
      ? "@media(scripting:enabled){@view-transition{navigation:auto}}"
      : "@view-transition{navigation:auto}") +
    "::view-transition-old(root),::view-transition-new(root){animation:none}.panel{view-transition-name:panel}::view-transition-old(panel){animation:out 180ms both}::view-transition-new(panel){animation:inside 420ms both}@keyframes out{to{opacity:0;transform:translateX(-10px)}}@keyframes inside{from{opacity:0;transform:translateX(10px)}}";
  const server = createServer((req, res) =>
    res
      .writeHead(200, { "content-type": "text/html" })
      .end(
        `<style>${css}</style><main class="panel"><a href="${req.url === "/one" ? "/two" : "/one"}">Next</a></main>`,
      ),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  let error = null;
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/one`);
    await page.getByRole("link", { name: "Next" }).click({ timeout: 2000 });
    await page.getByRole("link", { name: "Next" }).click({ timeout: 2000 });
  } catch (e) {
    error = e.message.split("\n")[0];
  } finally {
    await browser.close();
    await new Promise((r) => {
      server.close(r);
      server.closeAllConnections();
    });
  }
  const observation = { guarded, result: error ? "fail" : "pass", error };
  observations.push(observation);
  console.log(JSON.stringify(observation));
}

if (observations.map((item) => item.result).join() !== "fail,pass,fail") process.exitCode = 1;
