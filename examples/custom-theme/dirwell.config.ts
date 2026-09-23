import {
  createDefaultTheme,
  defaultThemeComponents,
  defineConfig,
  escapeHtml,
} from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/custom-theme",
  theme: createDefaultTheme({
    components: {
      PageShell: (props) =>
        defaultThemeComponents.PageShell({
          ...props,
          styles: `${props.styles}
            .release-brand { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-block-end: 1.25rem; padding: 1rem 1.1rem; background: #173c35; color: #f7f4e9; border-radius: .75rem; }
            .release-brand span { color: #bed6cd; font-size: .82rem; }
            [data-entry-type="artifact"] .entry { border-inline-start: 2px solid #70a892; }
            @media (max-width: 32rem) { .release-brand { align-items: flex-start; flex-direction: column; } }
          `,
        }),
      Breadcrumbs: (props) =>
        `<div class="release-brand"><strong>Northstar releases</strong><span>Verified public artifacts</span></div>${defaultThemeComponents.Breadcrumbs(props)}`,
      EntryRow: (props) => {
        const row = defaultThemeComponents.EntryRow(props);
        const label = props.entry.kind === "directory" ? "collection" : "artifact";
        return `<div data-entry-type="${escapeHtml(label)}">${row}</div>`;
      },
    },
  }),
});
