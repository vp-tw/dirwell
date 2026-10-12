import { createPlainTheme as createStandalonePlain } from "../packages/theme-plain/src/index.ts";
import type { PlainThemeOptions } from "../packages/theme-plain/src/index.ts";
export type { PlainThemeOptions } from "../packages/theme-plain/src/index.ts";
/** Preserve legacy directory URLs; standalone Plain defaults to portable file links. */
export function createPlainTheme(options: PlainThemeOptions = {}) {
  return createStandalonePlain({ portableLinks: false, ...options });
}
