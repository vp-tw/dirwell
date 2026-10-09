import { createCrosswaveTheme, defaultCrosswaveCategories, defineConfig } from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/crosswave-categories",
  theme: createCrosswaveTheme({
    color: "jade",
    project: { name: "Project Library" },
    categories: [
      ...defaultCrosswaveCategories.filter(
        (category) => category.id === "all" || category.id === "folder",
      ),
      {
        id: "code",
        label: "Source code",
        icon: {
          svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m8 5-6 7 6 7m8 0 6-7-6-7m-2-2-4 18"/></svg>',
        },
        match: { extensions: ["ts", "tsx", "js", "mjs", "cjs", "css"] },
      },
      {
        id: "archives",
        label: "Archives",
        icon: "other",
        match: {
          extensions: ["tar.gz"],
          mimeTypes: ["application/zip", "application/gzip", "application/x-tar"],
        },
      },
      ...defaultCrosswaveCategories
        .filter((category) => category.id === "image" || category.id === "document")
        .map((category) => ({
          ...category,
          label: category.id === "image" ? "Artwork" : "Documents",
        })),
      { id: "remaining", label: "Unsorted", icon: "other", match: "other" },
    ],
  }),
});
