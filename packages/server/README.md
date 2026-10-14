# @dirwell/server

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/sdk/).

`createExplorerHandler` returns an async `Request -> Response` handler for local filesystem roots. Pass a theme explicitly to enable HTML; no theme or HTTP framework is installed implicitly.

## Run a live folder

```sh
npm install @dirwell/server@0.0.1 @dirwell/theme-plain@0.0.1
```

Create `files/note.txt`, save this as `server.mjs`, then run `node server.mjs`:

```js
import { startExplorerServer } from "@dirwell/server/node";
import { createPlainTheme } from "@dirwell/theme-plain";
const server = await startExplorerServer({ root: "./files", theme: createPlainTheme() });
console.log(`${server.url}/browse/`);
process.once("SIGINT", async () => {
  await server.close();
});
```

Open the printed URL. It reads current files and serves selected bytes on loopback; Ctrl+C closes its connections. The Fetch handler below integrates into a Node application, where the host owns request forwarding and shutdown.

## Mount a Fetch handler

```js
import { createExplorerHandler } from "@dirwell/server";
import { createPlainTheme } from "@dirwell/theme-plain";
const handler = await createExplorerHandler({
  root: "./files",
  theme: createPlainTheme(),
  mountPath: "/downloads",
  files: "media",
  live: { intervalMs: 1000, maxClients: 32 },
  headers: () => ({ "Cache-Control": "no-store" }),
});
```

## Routes and publication

`/browse/{directory}/` renders the current directory through the same theme used for static builds. Native `?page=2` links work without JavaScript. `/listing?path=docs&offset=0&limit=100` returns public records after sorting the complete directory. `/__dirwell/listing/manifest`, `/__dirwell/listing/block`, `/__dirwell/page` and `/__dirwell/asset` support framework clients. Prefix every route with `mountPath` when configured.

The default HTML page size is 100 for pagination-capable themes. Live data defaults to one complete block because official rich clients need all entries for directory-wide search/sort. Set `blockSize` or an explicit `listing` policy to split responses; each block still reads the directory. `listing` accepts the same fixed or synchronous per-directory policy as core; `operation` identifies `server`, while `mode: 'ssg'` describes directory-oriented layout. JSON `/listing` defaults to 100 records and caps requests at 1,000, configurable through `pageSize` and `maxPageSize`.

Live blocks carry a public projection revision. If a requested revision has changed, the endpoint returns 410; the core browser loader retries once with a fresh manifest. Historical snapshots are not retained. Archive search is currently unavailable in live server mode; directory search remains available in rich themes.

## File transport

Integrated handlers disable file transport by default. `@dirwell/server/node` exports `startExplorerServer`, which defaults to loopback, an ephemeral port and `files: 'media'`.

Media mode previews PNG/JPEG/GIF/WebP/AVIF and supported audio/video inline. HTML, SVG and other files download with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. `files: 'attachment'` downloads everything; `files: 'inline'` is an explicit host override. `fileHref` delegates valid file links to a host.

File responses stream with backpressure and cancellation. GET supports a single byte range; HEAD returns metadata and ignores Range, following [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2). ETag validators run after authorization. Broken/outside/excluded links expose only their declared target text, never outside-root bytes.

## Headers, authorization and live updates

Successful responses default to `Cache-Control: no-store` and computed ETags. `headers(request)` customizes headers. Authorized responses require private caching and reject public/s-maxage policies. Host cache policies must account for identity variants and their desired freshness; a browser cache can avoid a network request entirely.

`authorize(request, logicalPath)` is request-level access control, not row-level redaction. Both the requested path and its canonical target are checked, including nested directory aliases. Checks precede directory child reads, file byte transfer and conditional responses. Allowing a parent listing exposes its selected child names; scope the root and filters accordingly.

`live` is opt-in. SSE notifications share one poll per canonical directory, recheck each subscriber's authorization, coalesce backpressured clients to the newest revision, send heartbeats and stop when the last subscriber leaves. The default interval is 1 second, minimum 25 ms; the default limit is 32 connections. Notifications identify public fact changes, not a replayable filesystem event log or the exact manifest revision. Svelte/Vue clients fetch fresh complete data and commit an update without resetting the current search or disabling its input.

There is no shared HTTP response/snapshot cache, filesystem watcher, distributed invalidation or transactional filesystem snapshot. Roots are assumed to be trusted local filesystems; hostile concurrent filesystem mutation and production-scale performance are not qualified. Stopping the Node server closes active connections as well as idle ones.

## Host integrations

- `@dirwell/server/express`: `await createExpressMiddleware(options)`, mounted with `app.use('/downloads', middleware)` and matching `mountPath`. It preserves Express's original URL.
- `@dirwell/server/fastify`: `app.register(await createFastifyPlugin(options))`. The plugin owns its route tree and uses [Fastify hijack](https://fastify.dev/docs/latest/Reference/Reply/), so response hooks such as onSend do not decorate its raw response; use Dirwell's header hook.
- Hono: `app.all('/downloads/*', context => handler(context.req.raw))` forwards its [real Request](https://hono.dev/docs/api/request) directly.
- `@dirwell/server/node`: `createNodeRequestListener` integrates an existing Node HTTP server; the host owns shutdown.

Express 5, Fastify 5 and Hono 4 have executed integration tests. Fetch compatibility alone does not qualify other framework adapters or Edge runtimes; this package requires Node filesystem access.

## Stable runtime validation

Handler configuration rejects unknown keys, invalid callbacks and malformed listing/live options before filesystem initialization. Sort and selection use Core's validated directory-service contract. The standalone Node helper separately checks `host` and integer `port` (0–65535) before opening a socket; those transport fields are not passed to Core or the Fetch handler. Custom theme objects remain extensible while their known render/hooks/listing contract is checked. These controls are included in `0.0.1`.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.
