# @dirwell/theme-authoring

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/themes/#source-component-customization).

Compile trusted Svelte/Vue wrapper components
into matching SSR and browser implementations. Plain and core do not depend on
this package or its compilers.

## Compile and publish a Vue wrapper

```sh
npm install @dirwell/theme-authoring@0.0.3 @dirwell/theme-crosswave@0.0.3 @dirwell/core@0.0.3
```

Create `files/note.txt`. Save this as `Downloads.vue`:

```vue
<script setup>
import Crosswave from "@dirwell/theme-crosswave/source";
defineProps({ model: { type: Object, required: true } });
</script>
<template>
  <Crosswave :model="model">
    <template #header="{ model: page }"
      ><span>{{ page.title }} · Project downloads</span></template
    >
  </Crosswave>
</template>
```

Save this as `build.mjs`, then run `node build.mjs`:

```js
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
import { generateExplorer } from "@dirwell/core";
const result = await buildFrameworkTheme({
  framework: "vue",
  component: "./Downloads.vue",
  output: "./generated-theme",
});
const { createTheme } = await import(result.themeUrl);
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createTheme({ title: "Downloads" }),
});
```

Serve the complete `generated` folder over HTTP and open its root. Compilation is awaited before importing the matching SSR/client theme. Ledger wrappers use `framework: 'svelte'` and `@dirwell/theme-ledger/source`; install Ledger in place of Crosswave. See the [complete paired source wrappers](https://github.com/vp-tw/dirwell/tree/main/examples/authoring).

Import Ledger from `@dirwell/theme-ledger/source`, or Crosswave from
`@dirwell/theme-crosswave/source`. Your wrapper accepts the `model` prop; public
model and row context types are available from each theme's `/model` entry.
Ledger accepts `header`, `row`, `actions` and `footer` snippets. Crosswave exposes named slots
with those names. Header/footer receive `{model}`; row/actions receive
`{model, entry, selected}`. These contexts track the current directory after
navigation or live updates. Row content lives inside the official link: do not
nest links, buttons, or other interactive controls inside it. The separate `actions` region is outside that link and accepts independent interactive controls. Official list
identity, keyboard selection, link actions, virtualization, pagination, dialogs,
appearance controls and gamepad lifecycle remain owned by the theme.

See the linked source wrappers for complete examples. These are source
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
HMR retains the current directory model, but does not guarantee filter/selection
persistence for those edits. Source writes are coalesced until stable for 100 ms
before compilation, so partial editor writes can recover cleanly. Compiler errors
produce Vite's overlay and recover after a valid edit. Development CSS loads
through Vite's client, so production output is the no-JavaScript/CSS acceptance
path. No Farm watcher is involved.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.
