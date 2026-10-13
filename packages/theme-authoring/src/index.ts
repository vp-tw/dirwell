import { build } from "vite";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  realpath,
  rename,
  rm,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { frameworkConfig, entrySource, validateFramework, type Framework } from "./compiler.ts";
import { noticeCollector } from "./notices.ts";
export type { Framework } from "./compiler.ts";
export interface BuildFrameworkThemeOptions {
  readonly framework: Framework;
  /** A wrapper component accepting the public model prop. Source code is trusted executable input. */
  readonly component: string;
  /** A dedicated compiler-owned directory. Existing unowned directories are rejected. */
  readonly output: string;
}
export interface BuiltFrameworkTheme {
  readonly themeUrl: string;
  readonly output: string;
}
const marker = ".dirwell-theme-authoring.json";
function contains(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}
/** Publishes a paired build only after both targets compile. Failed builds retain the previous output. */
export async function buildFrameworkTheme(
  options: BuildFrameworkThemeOptions,
): Promise<BuiltFrameworkTheme> {
  validateFramework(options.framework);
  const component = await realpath(path.resolve(options.component));
  if (path.extname(component) !== (options.framework === "svelte" ? ".svelte" : ".vue"))
    throw new TypeError("Component extension does not match framework");
  const requested = path.resolve(options.output);
  await mkdir(path.dirname(requested), { recursive: true });
  const output = path.join(await realpath(path.dirname(requested)), path.basename(requested));
  if (contains(output, component) || output === path.parse(output).root)
    throw new Error("Output cannot contain the component source");
  const lock = `${output}.dirwell-lock`;
  await mkdir(lock);
  const priorNodeEnv = process.env.NODE_ENV;
  let stage: string | undefined;
  let backup: string | undefined;
  try {
    let exists = false;
    try {
      const stat = await lstat(output);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error("Output must be a compiler-owned directory");
      const ownership = JSON.parse(await readFile(path.join(output, marker), "utf8"));
      if (ownership.version !== 1 || ownership.component !== component)
        throw new Error("Output belongs to a different component");
      exists = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      // A missing marker inside an existing directory is not ownership.
      try {
        await lstat(output);
        throw new Error("Refusing to replace unowned output");
      } catch (missing) {
        if (!(missing instanceof Error && "code" in missing && missing.code === "ENOENT"))
          throw missing;
      }
    }
    stage = await mkdtemp(`${output}.dirwell-stage-`);
    const config = frameworkConfig(options.framework, path.dirname(component));
    const notices = new Map<string, string>();
    for (const target of ["server", "client"] as const) {
      const id = path.join(path.dirname(component), `.dirwell-virtual-${target}.mjs`);
      await build({
        ...config,
        define: {
          "process.env.NODE_ENV": JSON.stringify("production"),
          __VUE_OPTIONS_API__: "true",
          __VUE_PROD_DEVTOOLS__: "false",
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
        },
        plugins: [
          ...(config.plugins ?? []),
          noticeCollector(notices),
          {
            name: "dirwell-paired-entry",
            resolveId: (source) => (source === id ? `\0${id}` : undefined),
            load: (source) =>
              source === `\0${id}` ? entrySource(options.framework, component, target) : undefined,
          },
        ],
        build: {
          outDir: stage,
          emptyOutDir: false,
          ssr: target === "server",
          minify: target === "client",
          target: target === "client" ? "es2020" : "node22",
          lib: {
            entry: id,
            formats: ["es"],
            cssFileName: "component",
            fileName: () => `${target}.mjs`,
          },
          cssCodeSplit: false,
          rollupOptions: {
            output: { inlineDynamicImports: true, entryFileNames: `${target}.mjs` },
          },
        },
      });
    }
    const notice = [...notices]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) => text)
      .join("\n\n");
    await writeFile(path.join(stage, "THIRD_PARTY_NOTICES.txt"), notice);
    for (const filename of ["server.mjs", "client.mjs"]) {
      const code = await readFile(path.join(stage, filename), "utf8");
      await writeFile(
        path.join(stage, filename),
        `/*!\n${notice.replaceAll("*/", "* /")}\n*/\n${code}`,
      );
    }
    const server = await readFile(path.join(stage, "server.mjs"), "utf8");
    const hash = createHash("sha256").update(server).digest("hex").slice(0, 16);
    await rename(path.join(stage, "server.mjs"), path.join(stage, `server-${hash}.mjs`));
    const styles = (
      await Promise.all(
        (await readdir(stage))
          .filter((name) => name.endsWith(".css"))
          .map((name) => readFile(path.join(stage!, name), "utf8")),
      )
    ).join("\n");
    await writeFile(path.join(stage, "styles.css"), styles);
    const theme = options.framework === "svelte" ? "ledger" : "crosswave";
    const factory = options.framework === "svelte" ? "createLedgerTheme" : "createCrosswaveTheme";
    await writeFile(
      path.join(stage, "theme.mjs"),
      `import {readFile} from 'node:fs/promises';
import {${factory}} from '@dirwell/theme-${theme}';
import {renderBody} from './server-${hash}.mjs';
const clientScript=await readFile(new URL('./client.mjs',import.meta.url),'utf8');
const styles=await readFile(new URL('./styles.css',import.meta.url),'utf8');
export const createTheme=(options={})=>${factory}(options,{renderBody,clientScript,styles,clientType:'module'});
`,
    );
    await writeFile(
      path.join(stage, "theme.d.mts"),
      `import type {ExplorerTheme} from '@dirwell/core';\nimport type {${options.framework === "svelte" ? "Ledger" : "Crosswave"}ThemeOptions} from '@dirwell/theme-${theme}';\nexport declare const createTheme: (options?: ${options.framework === "svelte" ? "Ledger" : "Crosswave"}ThemeOptions) => ExplorerTheme;\n`,
    );
    await writeFile(
      path.join(stage, marker),
      JSON.stringify({ version: 1, component, framework: options.framework }),
    );
    if (exists) {
      backup = `${stage}-previous`;
      await rename(output, backup);
    }
    try {
      await rename(stage, output);
      stage = undefined;
    } catch (error) {
      if (backup) {
        await rename(backup, output);
        backup = undefined;
      }
      throw error;
    }
    if (backup) {
      await rm(backup, { recursive: true });
      backup = undefined;
    }
    return { themeUrl: pathToFileURL(path.join(output, "theme.mjs")).href, output };
  } finally {
    if (priorNodeEnv === undefined && process.env.NODE_ENV === "production")
      delete process.env.NODE_ENV;
    if (stage) await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
