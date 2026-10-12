export type JsonValue = null | string | number | boolean | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
/** Copy owned presentation data into a JSON-only namespace before publication. */
export function copyJsonObject(value: unknown): JsonObject {
  const seen = new Set<object>();
  const copy = (input: unknown, depth: number): JsonValue => {
    if (depth > 32) throw new TypeError("Presentation data is too deeply nested");
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object" || input === null || seen.has(input))
      throw new TypeError("Presentation data must be finite, acyclic JSON");
    seen.add(input);
    try {
      if (Array.isArray(input)) return input.map((item) => copy(item, depth + 1));
      if (
        Object.getPrototypeOf(input) !== Object.prototype &&
        Object.getPrototypeOf(input) !== null
      )
        throw new TypeError("Presentation data must use plain objects");
      return Object.fromEntries(
        Object.entries(input).map(([key, item]) => [key, copy(item, depth + 1)]),
      );
    } finally {
      seen.delete(input);
    }
  };
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Presentation data must be an object");
  const result = copy(value, 0);
  if (typeof result !== "object" || result === null || Array.isArray(result))
    throw new TypeError("Presentation data must be an object");
  return result as JsonObject;
}
