export interface LandingCodeToken {
  readonly text: string;
  readonly tone?: "call" | "key" | "keyword" | "prompt" | "shell-package" | "string" | "output";
}
export const landingCode: Record<
  "terminal" | "theme" | "urls" | "naming",
  readonly LandingCodeToken[]
> = {
  terminal: [
    { text: "$ npx " },
    { text: "@dirwell/cli@alpha", tone: "shell-package" },
    { text: " server ./downloads\n" },
    { text: "Dirwell server: http://127.0.0.1:4173/browse/", tone: "output" },
  ],
  theme: [
    { text: 'import { createLedgerTheme } from "@dirwell/theme-ledger";\n' },
    { text: "export default ", tone: "keyword" },
    { text: '{ theme: createLedgerTheme({ title: "Downloads" }) };' },
  ],
  urls: [
    { text: "export default ", tone: "keyword" },
    { text: '{\n  build: { base: "/dirwell/", urlStrategy: "base", mode: "mpa" },\n};' },
  ],
  naming: [
    { text: "export default ", tone: "keyword" },
    {
      text: '{\n  build: {\n    outputName(directory) {\n      return directory.entries.some((entry) => entry.name === "index.html")\n        ? null : "index.html";\n    },\n  },\n};',
    },
  ],
};
