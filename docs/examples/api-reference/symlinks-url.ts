import { defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  mode: "mpa",
  base: "/downloads/",
  urls: "base",
  symlinks: { follow: true, boundary: "root", onCycle: "skip" },
});
