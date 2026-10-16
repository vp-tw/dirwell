import type { ListingEntry } from "./listing.ts";

/** Browser-safe, optional formatting. Raw listing sizes always remain bytes. */
export interface ByteFormatOptions {
  readonly units?: "binary" | "decimal" | "bytes";
  readonly locale?: string;
  /** Overrides automatic precision for converted units; bytes always stay integral. */
  readonly maximumFractionDigits?: number;
}

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify([locale, options]);
  let result = formats.get(key);
  if (!result) {
    result = new Intl.NumberFormat(locale, options);
    if (formats.size >= 32) formats.delete(formats.keys().next().value!);
    formats.set(key, result);
  }
  return result;
}

export function validateByteFormatOptions(options: ByteFormatOptions = {}): void {
  if (typeof options !== "object" || options === null || Array.isArray(options))
    throw new TypeError("Byte format options must be an object");
  for (const key of Object.keys(options))
    if (!["units", "locale", "maximumFractionDigits"].includes(key))
      throw new TypeError(`Unsupported byte format option: ${key}`);
  if (options.units !== undefined && !["binary", "decimal", "bytes"].includes(options.units))
    throw new TypeError("Unsupported byte units");
  if (options.locale !== undefined && (typeof options.locale !== "string" || !options.locale))
    throw new TypeError("Byte format locale must be a non-empty string");
  if (
    options.maximumFractionDigits !== undefined &&
    (!Number.isInteger(options.maximumFractionDigits) ||
      options.maximumFractionDigits < 0 ||
      options.maximumFractionDigits > 6)
  )
    throw new TypeError("maximumFractionDigits must be an integer from 0 to 6");
  numberFormat(options.locale ?? "en-US", {});
}

/** Format known byte counts. Missing/withheld sizes belong to the caller's state UI. */
export function formatBytes(bytes: number, options: ByteFormatOptions = {}): string {
  if (!Number.isSafeInteger(bytes) || bytes < 0)
    throw new RangeError("Bytes must be a non-negative safe integer");
  validateByteFormatOptions(options);
  const base = options.units === "decimal" ? 1000 : 1024;
  const units =
    options.units === "decimal"
      ? ["B", "kB", "MB", "GB", "TB", "PB", "EB"]
      : ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
  let value = bytes,
    index = 0;
  if (options.units !== "bytes") {
    while (value >= base && index < units.length - 1) {
      value /= base;
      index++;
    }
  }
  const precision: Intl.NumberFormatOptions =
    index === 0
      ? { maximumFractionDigits: 0 }
      : options.maximumFractionDigits === undefined
        ? { maximumSignificantDigits: 3 }
        : { maximumFractionDigits: options.maximumFractionDigits };
  // Check rounded numeric magnitude without parsing localized text.
  if (index > 0 && index < units.length - 1) {
    const digits = options.maximumFractionDigits ?? 2 - Math.floor(Math.log10(value));
    const factor = 10 ** digits;
    if (Math.round(value * factor) / factor >= base) {
      value /= base;
      index++;
    }
  }
  return `${numberFormat(options.locale ?? "en-US", precision).format(value)} ${units[index]}`;
}

export type SizeFacts = Pick<ListingEntry, "kind" | "size"> & {
  readonly link: Pick<
    NonNullable<ListingEntry["link"]>,
    "targetKind" | "targetSize" | "unavailable"
  > | null;
};

/** A directory has no content total. Unavailable targets are never a link-size fallback. */
export function sizeValue(entry: SizeFacts, basis: "entry" | "target" = "target"): number | null {
  if (entry.kind === "directory") return null;
  if (entry.kind !== "symlink" || basis === "entry") return entry.size;
  if (!entry.link || entry.link.unavailable || entry.link.targetKind !== "file") return null;
  return entry.link.targetSize;
}
