export interface LandingCodeToken {
  readonly text: string;
  readonly tone?: "call" | "key" | "keyword" | "prompt" | "shell-package" | "string" | "output";
}

export const landingCode: Record<
  "terminal" | "theme" | "urls" | "naming",
  readonly LandingCodeToken[]
> = {
  terminal: [
    { text: "$", tone: "prompt" },
    { text: " pnpm dlx " },
    { text: "dirwell", tone: "shell-package" },
    { text: " .\n" },
    { text: "Dirwell is watching /releases\nLocal: http://localhost:4173", tone: "output" },
  ],
  theme: [
    { text: "createDefaultTheme", tone: "call" },
    { text: "({\n  " },
    { text: "components", tone: "key" },
    { text: ": {\n    " },
    { text: "EntryRow", tone: "key" },
    { text: ": ReleaseRow,\n  },\n})" },
  ],
  urls: [
    { text: "defineConfig", tone: "call" },
    { text: "({\n  " },
    { text: "base", tone: "key" },
    { text: ": " },
    { text: '"/dirwell/"', tone: "string" },
    { text: ",\n  " },
    { text: "urls", tone: "key" },
    { text: ": " },
    { text: '"base"', tone: "string" },
    { text: ",\n  " },
    { text: "mode", tone: "key" },
    { text: ": " },
    { text: '"mpa"', tone: "string" },
    { text: ",\n})" },
  ],
  naming: [
    { text: "outputName", tone: "call" },
    { text: "(directory) {\n  " },
    { text: "return", tone: "keyword" },
    { text: " " },
    { text: "hasIndex", tone: "call" },
    { text: "(directory)\n    ? " },
    { text: "null", tone: "keyword" },
    { text: "\n    : " },
    { text: '"index.html"', tone: "string" },
    { text: ";\n}" },
  ],
};
