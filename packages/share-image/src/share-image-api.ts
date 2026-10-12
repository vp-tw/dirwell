import type { ShareImageOptions } from "./share-image.ts";
export type { ShareImageOptions } from "./share-image.ts";
/** Render a PNG at build time using the selected built-in theme and bundled fonts. */
export async function createShareImage(options: ShareImageOptions): Promise<File> {
  const { renderShareImage } = await import("./share-image.ts");
  return renderShareImage(options);
}
