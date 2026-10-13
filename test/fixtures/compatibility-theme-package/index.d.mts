import type { ExplorerTheme } from "@vp-tw/dirwell";

export interface ExampleThemeOptions {
  readonly title?: string;
}

export function createExampleTheme(options?: ExampleThemeOptions): ExplorerTheme;
