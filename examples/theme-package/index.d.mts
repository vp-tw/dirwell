import type { ExplorerTheme } from "@dirwell/core";

export interface ExampleThemeOptions {
  readonly title?: string;
}

export function createExampleTheme(options?: ExampleThemeOptions): ExplorerTheme;
