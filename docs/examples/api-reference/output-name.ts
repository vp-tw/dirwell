import { defineConfig } from "dirwell";

export default defineConfig({
  outputName(directory) {
    return directory.entries.some((entry) => entry.name === "index.html") ? null : "index.html";
  },
});
