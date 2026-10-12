/** Keep generated dates readable without JavaScript or a viewer-specific time zone. */
export function utcTimestamp(
  value: string | null | undefined,
): { readonly datetime: string; readonly label: string } | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const datetime = instant.toISOString();
  return { datetime, label: `${datetime.slice(0, 16).replace("T", " ")} UTC` };
}
