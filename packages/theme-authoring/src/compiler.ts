import { createRequire } from "node:module";
import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import vue from "@vitejs/plugin-vue";
import type { InlineConfig } from "vite";
export type Framework = "svelte" | "vue";
const require = createRequire(import.meta.url);
const vueRequire = createRequire(require.resolve("vue/package.json"));
const domRequire = createRequire(vueRequire.resolve("@vue/runtime-dom/package.json"));
const coreRequire = createRequire(domRequire.resolve("@vue/runtime-core/package.json"));
const vueAliases = [
  ["vue", require.resolve("vue/dist/vue.runtime.esm-bundler.js")],
  [
    "vue/server-renderer",
    vueRequire.resolve("@vue/server-renderer/dist/server-renderer.esm-bundler.js"),
  ],
  [
    "@vue/server-renderer",
    vueRequire.resolve("@vue/server-renderer/dist/server-renderer.esm-bundler.js"),
  ],
  ["@vue/runtime-dom", vueRequire.resolve("@vue/runtime-dom/dist/runtime-dom.esm-bundler.js")],
  ["@vue/runtime-core", domRequire.resolve("@vue/runtime-core/dist/runtime-core.esm-bundler.js")],
  ["@vue/reactivity", coreRequire.resolve("@vue/reactivity/dist/reactivity.esm-bundler.js")],
  ["@vue/shared", vueRequire.resolve("@vue/shared/dist/shared.esm-bundler.js")],
].map(([name, replacement]) => ({ find: new RegExp(`^${name}$`), replacement: replacement! }));
/** Both targets resolve the exact runtime shipped with this compiler. */
export function frameworkConfig(framework: Framework, root: string): InlineConfig {
  return {
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    plugins: [
      {
        name: "dirwell-pinned-runtime",
        enforce: "pre",
        resolveId(source, _importer, options) {
          if (source === "svelte")
            return options.ssr
              ? require.resolve("svelte")
              : path.join(
                  path.dirname(require.resolve("svelte/package.json")),
                  "src/index-client.js",
                );
          if (
            source.startsWith("svelte/") ||
            source === "@dirwell/theme-ledger/source" ||
            source === "@dirwell/theme-crosswave/source" ||
            source === "vue/server-renderer"
          )
            return require.resolve(source);
          return undefined;
        },
      },
      ...(framework === "svelte"
        ? [
            svelte({
              configFile: false,
              prebundleSvelteLibraries: false,
              disableDependencyReinclusion: true,
            }),
          ]
        : [vue()]),
      {
        name: "dirwell-runtime-optimization",
        enforce: "post",
        configResolved(config) {
          // Runtime imports resolve to compiler-owned absolute paths, not project dependencies.
          if (config.optimizeDeps.include)
            config.optimizeDeps.include = config.optimizeDeps.include.filter(
              (name) => !name.startsWith("svelte"),
            );
          for (const environment of Object.values(config.environments)) {
            if (environment.optimizeDeps.include)
              environment.optimizeDeps.include = environment.optimizeDeps.include.filter(
                (name) => !name.startsWith("svelte"),
              );
          }
        },
      },
    ],
    resolve: {
      dedupe: ["svelte", "vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue/reactivity"],
      alias: vueAliases,
    },
    ssr: { noExternal: true },
  };
}
export function entrySource(framework: Framework, component: string, target: "server" | "client") {
  const app = `import App from ${JSON.stringify(component)};`;
  if (target === "server")
    return (
      app +
      (framework === "svelte"
        ? "import {render} from 'svelte/server';export const renderBody=model=>render(App,{props:{model}}).body;"
        : "import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';export const renderBody=model=>renderToString(createSSRApp(App,{model}));")
    );
  const data =
    "const model=JSON.parse(document.querySelector('#dirwell-page-data').textContent);const target=document.querySelector('[data-dirwell-theme]');";
  return (
    app +
    data +
    (framework === "svelte"
      ? "import {hydrate,unmount} from 'svelte';const app=hydrate(App,{target,props:{model}});globalThis.__dirwellUnmount=()=>unmount(app);"
      : "import {createSSRApp} from 'vue';const app=createSSRApp(App,{model});app.mount(target);globalThis.__dirwellUnmount=()=>app.unmount();")
  );
}
export function validateFramework(framework: Framework) {
  if (framework !== "svelte" && framework !== "vue")
    throw new TypeError("Unsupported theme framework");
}
