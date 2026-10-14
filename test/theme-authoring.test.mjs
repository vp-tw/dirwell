import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { buildFrameworkTheme } from "../packages/theme-authoring/dist/index.mjs";
import { startAuthoringServer } from "../packages/theme-authoring/dist/dev.mjs";
import { generateExplorer } from "../packages/core/dist/index.mjs";
import { authoringFixture } from "./helpers/authoring.mjs";
for (const framework of ["svelte", "vue"])
  test(`${framework}: paired source compilation, scoped CSS, output ownership and failed-build rollback`, async () => {
    const fixture = await authoringFixture(framework);
    try {
      const leaf = framework === "svelte" ? "Leaf.svelte" : "Leaf.vue";
      await writeFile(
        path.join(fixture.root, leaf),
        framework === "svelte"
          ? '<script lang="ts">let {name}:{name:string}=$props();</script><strong data-nested>{name}</strong><style>strong{letter-spacing:1px}</style>'
          : '<script setup lang="ts">defineProps<{name:string}>();</script><template><strong data-nested>{{name}}</strong></template><style scoped>strong{letter-spacing:1px}</style>',
      );
      const nested = fixture.source
        .replace(
          framework === "svelte" ? '<script lang="ts">' : '<script setup lang="ts">',
          (framework === "svelte" ? '<script lang="ts">' : '<script setup lang="ts">') +
            `import Leaf from './${leaf}';`,
        )
        .replace(
          framework === "svelte"
            ? "<span data-custom-row>{entry.name}</span>"
            : "<span data-custom-row>{{ entry.name }}</span>",
          framework === "svelte"
            ? "<span data-custom-row><Leaf name={entry.name}/></span>"
            : '<span data-custom-row><Leaf :name="entry.name"/></span>',
        );
      await writeFile(fixture.component, nested);
      const result = await buildFrameworkTheme({
        framework,
        component: fixture.component,
        output: fixture.output,
      });
      const { createTheme } = await import(result.themeUrl);
      await generateExplorer({
        sourceDir: fixture.files,
        outputDir: path.join(fixture.root, "site"),
        theme: createTheme({ title: "Custom downloads" }),
      });
      const html = await readFile(path.join(fixture.root, "site/index.html"), "utf8");
      assert.match(html, /data-custom-header/);
      assert.match(html, /data-custom-row/);
      assert.match(html, /data-nested/);
      assert.match(html, /letter-spacing:1px/);
      assert.match(html, /data-custom-footer/);
      assert.match(html, /data-custom-action/);
      assert.match(html, /font-weight:600/);
      assert.match(html, /<script type="module"/);
      const notice = await readFile(path.join(fixture.output, "THIRD_PARTY_NOTICES.txt"), "utf8");
      assert.match(notice, framework === "svelte" ? /svelte@5.57.2/ : /vue@3.5.43/);
      const before = await readFile(path.join(fixture.output, "theme.mjs"), "utf8");
      await writeFile(
        fixture.component,
        framework === "svelte" ? "<script>invalid !!!</script>" : "<template><span></template>",
      );
      await assert.rejects(
        buildFrameworkTheme({ framework, component: fixture.component, output: fixture.output }),
      );
      assert.equal(await readFile(path.join(fixture.output, "theme.mjs"), "utf8"), before);
      assert.ok(
        !(await readdir(fixture.root)).some(
          (name) => name.includes("dirwell-stage") || name.includes("dirwell-lock"),
        ),
      );
      await writeFile(
        fixture.component,
        fixture.source
          .replace("My archive", "My custom archive")
          .replace("My media", "My custom media"),
      );
      await buildFrameworkTheme({
        framework,
        component: fixture.component,
        output: fixture.output,
      });
      const updated = await import(result.themeUrl + "?updated=1");
      await generateExplorer({
        sourceDir: fixture.files,
        outputDir: path.join(fixture.root, "updated"),
        theme: updated.createTheme(),
      });
      assert.match(
        await readFile(path.join(fixture.root, "updated/index.html"), "utf8"),
        /My custom/,
      );
      const unowned = path.join(fixture.root, "unowned");
      await mkdir(unowned);
      await writeFile(path.join(unowned, "keep.txt"), "keep");
      await assert.rejects(
        buildFrameworkTheme({ framework, component: fixture.component, output: unowned }),
        /unowned/,
      );
      assert.equal(await readFile(path.join(unowned, "keep.txt"), "utf8"), "keep");
      await assert.rejects(
        buildFrameworkTheme({ framework, component: fixture.component, output: fixture.root }),
        /contain/,
      );
    } finally {
      await fixture.close();
    }
  });
for (const framework of ["svelte", "vue"])
  test(`${framework}: local authoring server SSR and cleanup`, async () => {
    const fixture = await authoringFixture(framework);
    let server;
    try {
      server = await startAuthoringServer({
        framework,
        component: fixture.component,
        explorer: { root: fixture.files, live: { intervalMs: 50 } },
      });
      const response = await fetch(server.url + "/browse/");
      assert.equal(response.status, 200);
      assert.match(await response.text(), /data-custom-header/);
    } finally {
      if (server) await server.close();
      await fixture.close();
    }
  });
