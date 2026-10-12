import type { UnpluginInstance } from "unplugin";
import unplugin, { type DirwellPluginInput } from "./unplugin.ts";
export type { DirwellPluginOptions } from "./unplugin.ts";
const plugin: UnpluginInstance<DirwellPluginInput, true>["farm"] = unplugin.farm;
export default plugin;
