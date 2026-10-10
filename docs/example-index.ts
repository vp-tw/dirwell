import type { Plugin } from "vite";

/** Let native directory links in generated examples behave like a static host. */
export function exampleDirectoryIndexes(): Plugin {
  return {
    name: "dirwell-example-directory-indexes",
    configureServer(server) {
      const base = server.config.base.replace(/\/$/, "");
      const prefix = `${base}/examples/`;
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? "/", "http://dirwell.local");
        if (url.pathname.startsWith(prefix) && url.pathname.endsWith("/")) {
          request.url = `${url.pathname}index.html${url.search}`;
        }
        next();
      });
    },
  };
}
