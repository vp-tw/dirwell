import { escapeHtml } from "@dirwell/core";

/** A Node-side document/asset extension; retain the official theme's client and data protocol. */
export function withApplicationBranding(theme) {
  const name = "application-branding.css";
  return {
    ...theme,
    async render(context) {
      const rendered = await theme.render(context);
      const head = `<meta name="application-name" content="Approved downloads"><link rel="stylesheet" href="${escapeHtml(context.assetHref(name))}">`;
      return {
        ...rendered,
        html: rendered.html.replace("</head>", head + "</head>"),
        assets: {
          ...rendered.assets,
          [name]:
            ":root{--application-accent:#174ea6}header{border-bottom:2px solid var(--application-accent)}",
        },
      };
    },
  };
}
