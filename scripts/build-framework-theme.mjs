import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  name = process.argv[2];
if (!["theme-ledger", "theme-crosswave"].includes(name)) throw new Error("Unknown framework theme");
const folder = path.join(repo, "packages", name),
  generated = path.join(folder, ".generated"),
  output = path.join(folder, "dist");
await mkdir(generated, { recursive: true });
await mkdir(output, { recursive: true });
const require = createRequire(path.join(folder, "package.json"));
const framework = name === "theme-ledger" ? "svelte" : "vue";
let serverSource,
  clientSource,
  css = "";
if (framework === "svelte") {
  const { compile } = require("svelte/compiler"),
    filename = path.join(folder, "src/Ledger.svelte"),
    source = await readFile(filename, "utf8");
  for (const target of ["server", "client"]) {
    const compiled = compile(source, { filename, generate: target, css: "external", dev: false });
    await writeFile(path.join(generated, `App-${target}.mjs`), compiled.js.code);
    css = compiled.css?.code ?? css;
    for (const warning of compiled.warnings) console.log(`${warning.code}: ${warning.message}`);
  }
  serverSource =
    "import {render} from 'svelte/server';import App from './.generated/App-server.mjs';export const renderBody=model=>render(App,{props:{model}}).body;";
  clientSource =
    "import {hydrate,unmount} from 'svelte';import App from './App-client.mjs';const root=document.querySelector('[data-dirwell-theme]');const model=JSON.parse(document.querySelector('#dirwell-page-data').textContent);const app=hydrate(App,{target:root,props:{model}});globalThis.__dirwellUnmount=()=>unmount(app);";
} else {
  const { parse, compileScript } = require("@vue/compiler-sfc");
  await copyFile(path.join(folder, "src/wave.mjs"), path.join(generated, "wave.mjs"));
  const filename = path.join(folder, "src/Crosswave.vue"),
    source = await readFile(filename, "utf8"),
    { descriptor, errors } = parse(source, { filename });
  if (errors.length) throw errors[0];
  for (const target of ["server", "client"]) {
    const compiled = compileScript(descriptor, {
      id: "dirwell-crosswave",
      inlineTemplate: true,
      templateOptions: { ssr: target === "server" },
    });
    await writeFile(path.join(generated, `App-${target}.mjs`), compiled.content);
  }
  serverSource =
    "import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';import App from './.generated/App-server.mjs';export const renderBody=model=>renderToString(createSSRApp(App,{model}));";
  clientSource =
    "import {createSSRApp} from 'vue';import App from './App-client.mjs';const model=JSON.parse(document.querySelector('#dirwell-page-data').textContent);const app=createSSRApp(App,{model});app.mount(document.querySelector('[data-dirwell-theme]'));globalThis.__dirwellUnmount=()=>app.unmount();";
}
await writeFile(path.join(folder, "render-generated.mjs"), serverSource);
await writeFile(
  path.join(folder, "render-generated.d.mts"),
  "import type {ThemePage} from '../shared-theme/src/page.ts'; export declare const renderBody: (model: ThemePage & {readonly searchIndexHref?: string | null}) => string | Promise<string>;\n",
);
{
  await build({
    entryPoints: [path.join(folder, "src/styles-legacy.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: path.join(generated, "styles.mjs"),
  });
  const legacy = await import(pathToFileURL(path.join(generated, "styles.mjs")));
  await build({
    entryPoints: [path.join(repo, "packages/shared-theme/src/styles.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: path.join(generated, "adjustments.mjs"),
  });
  const adjustments = await import(pathToFileURL(path.join(generated, "adjustments.mjs")));
  await writeFile(
    path.join(output, "styles.css"),
    (legacy.defaultStyles ?? legacy.crosswaveStyles) +
      (framework === "svelte" ? adjustments.ledgerAdjustments : adjustments.crosswaveAdjustments),
  );
}

await writeFile(path.join(generated, "client-entry.mjs"), clientSource);
const clientBuild = await build({
  entryPoints: [path.join(generated, "client-entry.mjs")],
  metafile: true,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  conditions: ["browser"],
  define: { "import.meta.hot": "undefined" },
  outfile: path.join(output, "client.js"),
  minify: true,
});
const notices = new Map();
for (const input of Object.keys(clientBuild.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  let directory = path.dirname(path.resolve(folder, input));
  while (directory !== path.dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      if (!notices.has(manifest.name)) {
        const licenseFile = (await readdir(directory)).find((name) =>
          /^licen[sc]e(?:\.|$)/i.test(name),
        );
        if (!licenseFile) throw new Error(`Bundled package ${manifest.name} has no license file`);
        notices.set(
          manifest.name,
          `${manifest.name}@${manifest.version}\n${await readFile(path.join(directory, licenseFile), "utf8")}`,
        );
      }
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      directory = path.dirname(directory);
    }
  }
}
const notice = [...notices.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, text]) => text)
  .join("\n\n");
await writeFile(path.join(output, "THIRD_PARTY_NOTICES.txt"), notice);
const clientScript = await readFile(path.join(output, "client.js"), "utf8");
await writeFile(
  path.join(output, "client.js"),
  `/*!\n${notice.replaceAll("*/", "* /")}\n*/\n${clientScript}`,
);
await build({
  entryPoints: [path.join(folder, "src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  outfile: path.join(output, "index.mjs"),
  sourcemap: true,
});
await writeFile(path.join(output, "component.css"), css);
const packed = spawnSync("pnpm", ["exec", "vp", "pack"], { cwd: folder, encoding: "utf8" });
if (packed.status !== 0) throw new Error(packed.stdout + "\n" + packed.stderr);
console.log(packed.stdout);
console.log(`Built ${name} with framework-owned components`);
// Source exports must resolve without the repository-only shared-theme directory.
const sourceOutput = path.join(output, "source");
await mkdir(path.join(sourceOutput, "shared"), { recursive: true });
const componentName = framework === "svelte" ? "Ledger.svelte" : "Crosswave.vue";
const componentSource = (await readFile(path.join(folder, "src", componentName), "utf8"))
  .replaceAll("../../shared-theme/src/", "./shared/")
  .replaceAll('icons.ts"', 'icons.mjs"')
  .replaceAll('navigation.ts"', 'navigation.mjs"')
  .replaceAll('records.ts"', 'records.mjs"')
  .replaceAll('view-state.ts"', 'view-state.mjs"')
  .replaceAll('live-search.ts"', 'live-search.mjs"')
  .replaceAll('customization.ts"', 'customization.mjs"');
await writeFile(path.join(sourceOutput, componentName), componentSource);
for (const helper of [
  "icons",
  "navigation",
  "records",
  "customization",
  "view-state",
  "live-search",
]) {
  await build({
    entryPoints: [path.join(repo, "packages/shared-theme/src", `${helper}.ts`)],
    bundle: true,
    format: "esm",
    platform: "browser",
    packages: "external",
    outfile: path.join(sourceOutput, "shared", `${helper}.mjs`),
  });
}
if (framework === "vue")
  await copyFile(path.join(folder, "src/wave.mjs"), path.join(sourceOutput, "wave.mjs"));
await writeFile(
  path.join(sourceOutput, "component.d.mts"),
  framework === "svelte"
    ? `import type {Component, Snippet} from 'svelte';
import type {ThemePage, RowContext} from '../model.mjs';
export interface LedgerProps {readonly model: ThemePage; readonly header?: Snippet<[{model: ThemePage}]>; readonly row?: Snippet<[RowContext]>; readonly actions?: Snippet<[RowContext]>; readonly footer?: Snippet<[{model: ThemePage}]>;}
declare const Ledger: Component<LedgerProps>; export default Ledger;\n`
    : `import type {DefineComponent, SlotsType, VNode, ComponentOptionsMixin, PublicProps} from 'vue';
import type {ThemePage, RowContext} from '../model.mjs';
export interface CrosswaveSlots {header?: (props: {model: ThemePage}) => VNode[]; row?: (props: RowContext) => VNode[]; actions?: (props: RowContext) => VNode[]; footer?: (props: {model: ThemePage}) => VNode[];}
declare const Crosswave: DefineComponent<{model: ThemePage}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, {model: ThemePage}, {}, SlotsType<CrosswaveSlots>>; export default Crosswave;\n`,
);
