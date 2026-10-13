import { createServer, searchForWorkspaceRoot } from "vite";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createNodeRequestListener } from "@dirwell/server/node";
import type { ExplorerHandlerOptions } from "@dirwell/server";
import { createLedgerTheme, type LedgerThemeOptions, type ThemePage } from "@dirwell/theme-ledger";
import { createCrosswaveTheme, type CrosswaveThemeOptions } from "@dirwell/theme-crosswave";
import { frameworkConfig, entrySource, validateFramework, type Framework } from "./compiler.ts";
export interface AuthoringServerOptions {
  readonly framework: Framework;
  readonly component: string;
  readonly explorer: Omit<ExplorerHandlerOptions, "theme" | "mountPath">;
  readonly themeOptions?: LedgerThemeOptions & CrosswaveThemeOptions;
  readonly port?: number;
}
/** Trusted local development only: Vite serves executable source modules as well as explorer data. */
export async function startAuthoringServer(options: AuthoringServerOptions) {
  validateFramework(options.framework);
  const component = await realpath(path.resolve(options.component));
  if (path.extname(component) !== (options.framework === "svelte" ? ".svelte" : ".vue"))
    throw new TypeError("Component extension does not match framework");
  const config = frameworkConfig(options.framework, path.dirname(component));
  const require = createRequire(import.meta.url);
  const id = "/@dirwell/authoring-";
  const vite = await createServer({
    ...config,
    appType: "custom",
    mode: "development",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: true, optimizeDeps: { noDiscovery: true, include: [] } },
    server: {
      host: "127.0.0.1",
      port: options.port ?? 0,
      strictPort: true,
      watch: { awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 } },
      fs: {
        allow: [
          searchForWorkspaceRoot(path.dirname(component)),
          searchForWorkspaceRoot(path.dirname(require.resolve("@dirwell/theme-ledger/source"))),
        ],
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      {
        name: "dirwell-authoring-entry",
        resolveId: (source) => (source.startsWith(id) ? `\0${source}` : undefined),
        load(source) {
          if (source === `\0${id}client`)
            return entrySource(options.framework, component, "client");
          if (source === `\0${id}server`)
            return entrySource(options.framework, component, "server");
          return undefined;
        },
      },
    ],
  });
  try {
    const renderBody = async (model: ThemePage) => {
      const module: unknown = await vite.ssrLoadModule(`${id}server`).catch((error: unknown) => {
        if (error instanceof Error) {
          vite.ssrFixStacktrace(error);
          vite.config.logger.error(error.stack ?? error.message);
        }
        throw error;
      });
      if (
        module === null ||
        typeof module !== "object" ||
        !("renderBody" in module) ||
        typeof module.renderBody !== "function"
      )
        throw new Error("Invalid compiled renderer");
      const body: unknown = await module.renderBody(model);
      if (typeof body !== "string") throw new Error("Invalid compiled body");
      return body;
    };
    const renderer = {
      renderBody,
      clientScript: `import '/@vite/client';import '${id}client';`,
      clientType: "module" as const,
    };
    const theme =
      options.framework === "svelte"
        ? createLedgerTheme(options.themeOptions, renderer)
        : createCrosswaveTheme(options.themeOptions, renderer);
    const listener = await createNodeRequestListener({
      files: "media",
      ...options.explorer,
      theme,
    });
    vite.middlewares.use((request, response, next) => {
      if (request.url?.startsWith("/@") || request.url?.startsWith("/node_modules/")) {
        next();
        return;
      }
      void listener(request, response);
    });
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === "string")
      throw new Error("Authoring server address unavailable");
    return { url: `http://127.0.0.1:${address.port}`, close: () => vite.close() };
  } catch (error) {
    await vite.close();
    throw error;
  }
}
