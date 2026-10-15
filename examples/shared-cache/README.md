# Cache a public listing with Redis

Run two Hono servers that share a Redis cache for the public `/api/files` listing. A cache hit avoids reading and describing the directory again. The explorer pages at `/downloads/browse/` continue to read current files. The example uses published Dirwell packages; it does not require a Dirwell build.

Use this when several Node processes repeatedly serve the same public listing. For a single local folder, start with the [Dirwell CLI server](https://vp-tw.github.io/dirwell/getting-started/) and add caching only if repeated reads are a problem.

## Start the example

You need Node.js 22.12 or later and Docker with Compose. Clone the repository and install this example's dependencies:

```sh
git clone https://github.com/vp-tw/dirwell.git
cd dirwell/examples/shared-cache
npm ci --ignore-scripts
docker compose up -d
```

This installs only the example's dependencies and starts a dedicated Redis on `127.0.0.1:6380`. You can also copy this directory into your own project; the commands below run from this directory.

Start server A in this terminal:

```sh
SERVER_ID=a PORT=3000 npm start
```

In a second terminal, open the same directory and start server B:

```sh
SERVER_ID=b PORT=3001 npm start
```

Both processes read `files/` and use the same Redis dataset identifier. Open [the explorer on server A](http://127.0.0.1:3000/downloads/browse/) to browse the sample files.

## See the cache work

In a third terminal, from this directory:

```sh
npm run invalidate
curl -i http://127.0.0.1:3000/api/files
curl -i http://127.0.0.1:3001/api/files
```

`/api/files` returns the first page of the root listing, up to 100 entries. Its `total` field counts all entries. The response headers show where the data came from:

| Header            | Server A, first request | Server B, second request |
| ----------------- | ----------------------- | ------------------------ |
| `X-Server-Id`     | `a`                     | `b`                      |
| `X-Listing-Cache` | `miss`                  | `hit`                    |
| `X-Source-Reads`  | `1`                     | `0`                      |

`X-Source-Reads` counts fresh reads made for `/api/files` in that process since startup. Make the second request within ten seconds so the first cached result is still available. If the cache says `bypass`, check `http://127.0.0.1:3000/health`: `cacheReady` becomes `true` when Redis connects.

## Update the files

Create a sample file, then invalidate the listing:

```sh
printf 'Another sample download.\n' > files/new-file.txt
npm run invalidate
curl -i http://127.0.0.1:3001/api/files
```

The response includes `new-file.txt` and reports a cache miss. Without invalidation, a stored listing expires after ten seconds and the next request reads the directory again.

The invalidation command changes which cache key both servers use. A read that started earlier may still return its old result, but its later cache write cannot replace the result used by subsequent requests. If the servers use separate copies of the files, update both copies before invalidating. Redis shares listing data; it does not copy files between servers.

## Run without Redis

```sh
docker compose stop redis
curl -i http://127.0.0.1:3000/api/files
```

The API still reads the files and reports `X-Listing-Cache: bypass`. Restart Redis with `docker compose up -d`; the client reconnects automatically. Redis commands have a 500 ms timeout and are not queued while disconnected. A cache outage increases filesystem work, so this fallback needs load testing before use on a busy service.

Stop the two Node processes with Ctrl+C. Remove the example's Redis container with `docker compose down`. Remove `files/new-file.txt` if you created it.

## Use the pattern in an application

`app.mjs` mounts Dirwell at `/downloads` and adds the cached `/api/files` route. `cache.mjs` reads and stores listing data; `invalidate.mjs` changes the shared cache key. The explorer, file downloads and other Dirwell routes read normally and do not use this cache. HTTP responses remain `no-store`; Redis stores application data on the server.

All files and listing data in this example are public. For private downloads, start with the [session-authorized recipe](../private-downloads/README.md). This public cache does not implement per-user visibility or permission revocation.

| Setting      | Default                              | When to change it                                                                                                 |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `FILES_DIR`  | This example's `files/`              | Point to your public directory; relative paths resolve from cwd.                                                  |
| `DATASET_ID` | `shared-cache-example`               | Give each public directory its own identifier. Share it only between servers that should return the same listing. |
| `REDIS_URL`  | `redis://127.0.0.1:6380`             | Connect to your Redis service.                                                                                    |
| `PORT`       | `3000`                               | Choose an available loopback port for each process.                                                               |
| `SERVER_ID`  | The process ID with a `node-` prefix | Label the responses when comparing processes.                                                                     |

Two simultaneous cache misses may both read the source. The example has no distributed lock and makes no production throughput guarantee. It keeps Redis dependencies outside the Dirwell SDK and leaves connection ownership with the application.

## Run the checks

With Redis running:

```sh
npm test
```

The checks start two temporary Node processes and cover shared hits, dataset isolation, file updates, invalidation and fresh reads without Redis. Separate deterministic tests hold a read open to exercise invalidation races and concurrent misses.
