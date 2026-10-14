import type { ShareImageOptions } from "./share-image.ts";
export type { ShareImageOptions, ShareImageFonts } from "./share-image.ts";
/** Render a PNG at build time using the selected preset and bundled or supplied local fonts. */
export async function createShareImage(options: ShareImageOptions): Promise<File> {
  const { renderShareImage } = await import("./share-image.ts");
  return renderShareImage(options);
}
