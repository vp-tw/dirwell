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
    { text: " npx " },
    { text: "@vp-tw/dirwell@alpha", tone: "shell-package" },
    { text: " serve ./downloads\n" },
    { text: "Dirwell is watching /downloads\nLocal: http://127.0.0.1:4173", tone: "output" },
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
