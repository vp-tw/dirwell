import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const project = await mkdtemp(path.join(tmpdir(), "dirwell-package-proof-"));
const registry = process.argv[2] === "--registry";

function run(command, args, cwd = project) {
  return execFileSync(command, args, { cwd, stdio: "inherit" });
}

function pack(cwd) {
  const result = JSON.parse(
    execFileSync("npm", ["pack", "--pack-destination", project, "--json"], {
      cwd,
      encoding: "utf8",
    }),
  );
  const [artifact] = Array.isArray(result) ? result : Object.values(result);
  return { artifact, filename: path.join(project, artifact.filename) };
}

try {
  const core = pack(root);
  const theme = pack(path.join(root, "examples/theme-package"));
  assert.equal(core.artifact.name, metadata.name);
  assert.equal(core.artifact.version, metadata.version);
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify(
      {
        name: "dirwell-package-consumer",
        private: true,
        type: "module",
        packageManager: metadata.packageManager,
        dependencies: {
          [metadata.name]: registry ? metadata.version : `file:${core.filename}`,
          "dirwell-example-theme": `file:${theme.filename}`,
          rollup: metadata.devDependencies.rollup,
          webpack: metadata.devDependencies.webpack,
          typescript: metadata.devDependencies.typescript,
        },
      },
      null,
      2,
    ),
  );
  run("pnpm", ["install", "--ignore-scripts"]);
  await mkdir(path.join(project, "files/docs"), { recursive: true });
  await writeFile(path.join(project, "files/a & b.txt"), "external consumer file");
  await writeFile(path.join(project, "files/docs/guide.md"), "guide");
  await writeFile(path.join(project, "entry.js"), "console.log('host');");
  await writeFile(
    path.join(project, "verify.mjs"),
    `
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateExplorer,createCrosswaveTheme} from ${JSON.stringify(metadata.name)};
import {createExampleTheme} from 'dirwell-example-theme';
import {rollup} from 'rollup';
import Dirwell from ${JSON.stringify(`${metadata.name}/rollup`)};
for (const host of ['unplugin','vite','rollup','rolldown','webpack','rspack','rsbuild','esbuild','farm','bun']) await import(${JSON.stringify(metadata.name)}+'/'+host);
for (const mode of ['ssg','mpa']) {
 await generateExplorer({sourceDir:'files',outputDir:mode,mode,theme:createExampleTheme({title:'<Downloads>'})});
 const html=await readFile(mode+'/index.html','utf8');
 assert.match(html,/&lt;Downloads&gt;/);assert.match(html,/a &amp; b.txt/);
 assert.equal(await readFile(mode+'/a & b.txt','utf8'),'external consumer file');
 assert.match(await readFile(mode+'/docs/index.html','utf8'),/Parent directory/);
 assert.ok((await readFile(mode+(mode==='mpa'?'/__dirwell':'')+'/package-theme.css')).length>0);
}
for(const mode of ['ssg','mpa']){
 await generateExplorer({sourceDir:'files',outputDir:'crosswave-'+mode,mode,theme:createCrosswaveTheme({color:'jade'})});
 const output='crosswave-'+mode;
 assert.match(await readFile(output+'/index.html','utf8'),/Crosswave/);
 assert.match(await readFile(output+(mode==='mpa'?'/__dirwell':'')+'/crosswave.js','utf8'),/getGamepads/);
 assert.ok((await readFile(output+(mode==='mpa'?'/__dirwell':'')+'/crosswave.css')).length>0);
}
const bundle=await rollup({input:'entry.js',plugins:[Dirwell({root:'files'})]});
try {await bundle.write({dir:'rollup-output',format:'es'});} finally {await bundle.close();}
assert.equal(await readFile('rollup-output/dirwell/a & b.txt','utf8'),'external consumer file');
console.log('Public imports, external SSG/MPA theme assets, encoded names, and Rollup consumption passed.');
`,
  );
  run(process.execPath, ["verify.mjs"]);
  await writeFile(
    path.join(project, "webpack.config.cjs"),
    `module.exports=async()=>{const {default:Dirwell}=await import(${JSON.stringify(`${metadata.name}/webpack`)});return {mode:'production',entry:require('node:path').resolve('entry.js'),output:{path:require('node:path').resolve('webpack-output')},plugins:[Dirwell({root:'files'})]}};`,
  );
  await writeFile(
    path.join(project, "webpack-proof.cjs"),
    `const webpack=require('webpack');(async()=>{const options=await require('./webpack.config.cjs')();const compiler=webpack(options);try{await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):stats.hasErrors()?reject(new Error(stats.toString())):resolve()));}finally{await new Promise(resolve=>compiler.close(resolve));}console.log('CommonJS async webpack configuration passed.');})().catch(error=>{console.error(error);process.exitCode=1;});`,
  );
  run(process.execPath, ["webpack-proof.cjs"]);
  assert.equal(
    await readFile(path.join(project, "webpack-output/dirwell/a & b.txt"), "utf8"),
    "external consumer file",
  );
  await writeFile(
    path.join(project, "verify.ts"),
    `import {defineConfig,type ExplorerTheme} from ${JSON.stringify(metadata.name)};import type {DirwellPluginOptions} from ${JSON.stringify(`${metadata.name}/unplugin`)};import {createExampleTheme} from 'dirwell-example-theme';const theme:ExplorerTheme=createExampleTheme({title:'Downloads'});const config=defineConfig({theme});const plugin:DirwellPluginOptions={root:'files',theme:config.theme!};void plugin;`,
  );
  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "--module",
    "NodeNext",
    "--skipLibCheck",
    "--target",
    "ES2024",
    "verify.ts",
  ]);
  run(process.execPath, [
    "node_modules/@vp-tw/dirwell/dist/bin.mjs",
    "build",
    "files",
    "-o",
    "cli-output",
  ]);
  assert.equal(
    await readFile(path.join(project, "cli-output/a & b.txt"), "utf8"),
    "external consumer file",
  );
  console.log(
    `Package proof passed for ${metadata.name}@${metadata.version} (${registry ? "registry" : "tarball"}); ${core.artifact.entryCount} packed files.`,
  );
} finally {
  await rm(project, { recursive: true, force: true });
}
