import { compareEntryValues, fuzzyScore } from "./dirwell.runtime.js";

let rows = [];

self.addEventListener("message", ({ data }) => {
  if (data.type === "init") {
    rows = data.rows;
    return;
  }
  if (data.type !== "query") return;
  const { generation, query, filter, includeLinks, sort } = data;
  const matches = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (filter === "link" && !row.link) continue;
    if (
      (filter === "directory" || filter === "file") &&
      (row.kind !== filter || (!includeLinks && row.link))
    )
      continue;
    const score = fuzzyScore(query, row.search);
    if (query !== "" && score === null) continue;
    matches.push({ index, row, score });
  }
  matches.sort((left, right) => {
    if (query !== "" && left.score !== right.score) return (right.score ?? 0) - (left.score ?? 0);
    return compareEntryValues(left.row, right.row, sort) || left.index - right.index;
  });
  const indices = Uint32Array.from(matches, ({ index }) => index);
  self.postMessage({ generation, indices }, [indices.buffer]);
});
