import { createDefaultTheme, defaultThemeComponents, defineConfig, escapeHtml } from "dirwell";

const label = "Downloads & releases";

export default defineConfig({
  theme: createDefaultTheme({
    components: {
      Footer: (props) => `<p>${escapeHtml(label)}</p>${defaultThemeComponents.Footer(props)}`,
    },
  }),
});
