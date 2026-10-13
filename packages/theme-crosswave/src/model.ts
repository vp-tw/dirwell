import type { ThemePage as BaseThemePage } from "../../shared-theme/src/page.ts";
export type { ListingEntry } from "@dirwell/core";
export interface ThemePage extends BaseThemePage {
  readonly categories: readonly {
    readonly id: string;
    readonly label: string;
    readonly svg: string;
  }[];
  readonly color: "azure" | "violet" | "amber" | "rose" | "jade" | "graphite";
  readonly gamepad: boolean;
  readonly backgroundMotion: boolean;
}
/** The authoring compiler supplies both halves from the same source. */
export interface FrameworkRenderer {
  readonly renderBody: (model: ThemePage) => string | Promise<string>;
  readonly clientScript: string;
  readonly styles?: string;
  readonly clientType?: "module";
}
export interface RowContext {
  readonly model: ThemePage;
  readonly entry: import("@dirwell/core").ListingEntry;
  readonly selected: boolean;
}
