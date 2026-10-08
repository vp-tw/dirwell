// Run on a generated flat-case page with: agent-browser eval --stdin < scripts/benchmark-browser.js
(async () => {
  const ready = async (predicate, timeoutMs = 10_000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (predicate()) return Math.round(performance.now() - start);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for benchmark result");
  };
  const nextFrames = async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  };
  const localRows = () => [...document.querySelectorAll("[data-entry-list] [data-entry]")];
  const headerText = () => document.querySelector("main header")?.textContent ?? "";
  await ready(
    () =>
      document.querySelector("[data-explorer]")?.getAttribute("aria-busy") !== "true" &&
      localRows().length > 0,
  );

  const search = document.querySelector("[data-search-input]");
  search.value = "release-09999";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  const filterMs = await ready(
    () =>
      /1 entry\b/.test(headerText()) && localRows()[0]?.dataset.name?.startsWith("release-09999"),
  );
  search.value = "";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  const clearMs = await ready(() => /10000 entries\b/.test(headerText()) && localRows().length > 5);

  const direction = document.querySelector("[data-sort-direction]");
  const nextDirection = direction.value === "asc" ? "desc" : "asc";
  direction.value = nextDirection;
  direction.dispatchEvent(new Event("change", { bubbles: true }));
  const expectedFirst = nextDirection === "desc" ? "release-09999" : "release-00000";
  const sortMs = await ready(() => localRows()[0]?.dataset.name?.startsWith(expectedFirst));

  document.querySelector("[data-global-open]").click();
  document.querySelector("[data-global-results]").replaceChildren();
  const globalInput = document.querySelector("[data-global-input]");
  globalInput.value = "release-09999";
  globalInput.dispatchEvent(new Event("input", { bubbles: true }));
  const globalFirstResultMs = await ready(() =>
    document
      .querySelector("[data-global-results] [data-entry]")
      ?.dataset.name?.startsWith("release-09999"),
  );
  document.querySelector("[data-global-close]").click();

  const points = innerWidth < 600 ? 20 : 30;
  const max = document.documentElement.scrollHeight - innerHeight;
  let blank = 0;
  let maxGapPx = 0;
  let maxTwoFrameMs = 0;
  let previous = performance.now();
  for (let index = 0; index < points; index += 1) {
    scrollTo(0, max * (0.1 + (0.8 * index) / (points - 1)));
    await nextFrames();
    const now = performance.now();
    maxTwoFrameMs = Math.max(maxTwoFrameMs, now - previous);
    previous = now;
    const visible = localRows()
      .map((row) => row.getBoundingClientRect())
      .filter((rect) => rect.bottom > 0 && rect.top < innerHeight)
      .sort((left, right) => left.top - right.top);
    if (visible.length === 0) blank += 1;
    for (let row = 1; row < visible.length; row += 1) {
      maxGapPx = Math.max(maxGapPx, visible[row].top - visible[row - 1].bottom);
    }
  }
  return JSON.stringify({
    viewport: [innerWidth, innerHeight],
    navigationMs: Math.round(performance.getEntriesByType("navigation")[0]?.duration ?? 0),
    filterMs,
    clearMs,
    sortMs,
    globalFirstResultMs,
    scrollPoints: points,
    blankScrollPoints: blank,
    maxGapPx: Math.round(maxGapPx),
    maxTwoFrameMs: Math.round(maxTwoFrameMs),
    heapMb: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024),
  });
})();
