---
title: Server integrations
description: Use Dirwell routes inside a Node application and connect them to application services.
---

Mount Dirwell in an existing Node application when it needs to serve files that change. Your application owns routing, sessions and service connections; Dirwell supplies directory listings, explorer pages and file responses. For a standalone folder server, use the [CLI](../getting-started/).

The [SDK guide](../sdk/#standalone-and-integrated-http) shows the Fetch handler and Node, Express, Fastify and Hono integration paths. Dirwell needs Node filesystem access. A framework's support for edge runtimes does not make those runtimes suitable for this handler.

## Cache a public listing

The [shared-cache example](https://github.com/vp-tw/dirwell/tree/main/examples/shared-cache) runs two Hono servers that share public listing data through Redis. A request to the second server can reuse the first server's result instead of reading the directory again.

Run it locally with Node.js and Redis. The example README takes you through startup, cache hits, file changes, invalidation and a Redis outage. It installs published packages without building Dirwell itself.

| Route                | Behavior                                                         |
| -------------------- | ---------------------------------------------------------------- |
| `/api/files`         | Cached first page of the public root listing, up to 100 entries. |
| `/downloads/browse/` | Explorer pages read the current directory normally.              |
| `/downloads/files/…` | File downloads use the original Dirwell handler.                 |

Each stored listing expires after ten seconds. After updating the files, run the example's `npm run invalidate` command to make the next API request read them again. Both processes share the same dataset identifier; different datasets use different identifiers. Redis stores listing data and does not synchronize files between machines.

The application owns the Redis client and handles unavailable or invalid cache entries by reading the files. Two simultaneous misses may both read the source. The example demonstrates this application pattern without adding Redis to the Dirwell SDK.

Use it for public data. It does not cache user-specific listings, search results, HTML or update streams. For an access-controlled explorer, start with the [private-downloads recipe](https://github.com/vp-tw/dirwell/tree/main/examples/private-downloads). Reusing cached data for different users requires a separate authorization and invalidation design.

## Decide whether to add a cache

Start with normal live reads. A cache is useful when repeated listing work is expensive enough to justify a Redis dependency and a delay before file changes appear. Static output can use the caching facilities of its HTTP host instead; it does not need a runtime listing cache.

Choose which data may be reused, how long it may be stored, and who invalidates it after a change. Measure source work and response time with your own directory and request load. The example's hit and read-count headers show which path ran; they are not a production performance benchmark.

## Directory route normalization

Server adapters accept `routing.directoryUrls` from Core. The default root HTML route ends in `/browse/index.html`; slash and clean modes use `/browse/` and `/browse`. Canonical aliases redirect only after authorization; file/data namespaces stay separate. Register the intended mount in the host application and test route conflicts. See [directory URLs](../urls/).
