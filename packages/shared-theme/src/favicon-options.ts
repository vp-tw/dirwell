/** A local image to publish, or a URL the caller already serves. */
export type FaviconDescriptor = (
  | { readonly source: File | string | URL; readonly href?: never }
  | { readonly href: string; readonly source?: never }
) & {
  readonly type?: string;
  readonly sizes?: string;
  readonly media?: string;
};

/** A custom icon list replaces all theme defaults. */
export type FaviconOptions = false | FaviconDescriptor | readonly FaviconDescriptor[];
