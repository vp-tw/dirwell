# @dirwell/theme-authoring

Unreleased private `0.0.1-alpha`. Compile trusted Svelte/Vue wrapper components
into matching SSR and browser implementations. Plain and core do not depend on
this package or its compilers.

```js
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
const result = await buildFrameworkTheme({
  framework: "svelte", // 'vue' for Crosswave
  component: "./Ledger.svelte",
  output: "./generated-theme",
});
const { createTheme } = await import(result.themeUrl);
// Pass createTheme({title: 'Downloads'}) to generateExplorer or createExplorerHandler.
```

Import Ledger from `@dirwell/theme-ledger/source`, or Crosswave from
`@dirwell/theme-crosswave/source`. Your wrapper accepts the `model` prop; public
model and row context types are available from each theme's `/model` entry.
Ledger accepts `header`, `row` and `footer` snippets. Crosswave exposes named slots
with those names. Header/footer receive `{model}`; row receives
`{model, entry, selected}`. These contexts track the current directory after
navigation or live updates. Row content lives inside the official link: do not
nest links, buttons, or other interactive controls inside it. Official list
identity, keyboard selection, link actions, virtualization, pagination, dialogs,
appearance controls and gamepad lifecycle remain owned by the theme.

See `examples/authoring` in the repository for complete wrappers. These are source
customizations, not serializable CLI options. The output's `theme.mjs#createTheme`
can be selected with the CLI's existing explicit module-factory argument.

Both targets use pinned framework runtimes and official Vite plugins. Nested
components, TypeScript script blocks, component CSS and static imported assets
are compiled together. Dedicated output directories have ownership markers and
are replaced only after both targets succeed. Failed builds retain the previous
output. Do not run the compiler while serving files from its output; rebuild,
create a fresh theme instance, then restart/swap the consumer. Node module caches
require a fresh import URL after replacing an already-imported `theme.mjs`.

## Local development

```js
import { startAuthoringServer } from "@dirwell/theme-authoring/dev";
const server = await startAuthoringServer({
  framework: "vue",
  component: "./Crosswave.vue",
  explorer: { root: "./files", live: { intervalMs: 500 } },
});
console.log(server.url);
// Await server.close() when finished; it owns Vite, sockets and filesystem watchers.
```

The server binds to loopback only. Use Portless to provide a named development
URL. This is a trusted local source-development server, not a production
transport or authorization boundary: Vite serves project source modules. Do not
proxy it publicly. The production server remains `@dirwell/server`.

Source edits use official framework HMR; file changes use the explorer's separate
SSE revision protocol. CSS-only edits preserve the current component state. Wrapper template/snippet
edits and script changes can remount child components and reset search/selection;
HMR does not guarantee state persistence for those edits. Compiler errors
produce Vite's overlay and recover after a valid edit. Development CSS loads
through Vite's client, so production output is the no-JavaScript/CSS acceptance
path. No Farm watcher is involved.
