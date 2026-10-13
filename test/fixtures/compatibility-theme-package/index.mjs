import { createShareImage, describeContent, escapeHtml } from "@vp-tw/dirwell";

const styles =
  "body{max-width:72ch;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif}li{margin:.75rem 0;overflow-wrap:anywhere}a:focus-visible{outline:3px solid #005fcc;outline-offset:4px}";

/** A separate package consumes only Dirwell's exported rendering API. */
export function createExampleTheme({ title = "External theme example" } = {}) {
  if (typeof title !== "string") throw new TypeError("title must be a string");
  return {
    name: "external-package-example",
    searchIndex: false,
    metadataDefaults: {
      siteName: title,
      repositoryName: "Independent theme example",
      image: ({ site }) =>
        createShareImage({
          theme: "plain",
          title: site.name,
          description: describeContent(site),
          repositoryName: site.repositoryName,
        }),
    },
    render(context) {
      const parent =
        context.directory.parent === null
          ? ""
          : `<p><a href="${escapeHtml(context.hrefForDirectory(context.directory.parent.relativePath))}">Parent directory</a></p>`;
      const rows = context.directory.entries
        .map((entry) => {
          const href = context.hrefFor(entry);
          const label = escapeHtml(entry.name);
          return `<li>${href === null ? `<span>${label}</span>` : `<a href="${escapeHtml(href)}"${context.exitsExplorerFor(entry) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`}</li>`;
        })
        .join("");
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(title)}</title>`}<link rel="stylesheet" href="${escapeHtml(context.assetHref("package-theme.css"))}"></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(context.directory.current.relativePath || "/")}</p>${parent}<ul>${rows}</ul></main></body></html>`;
      return { html, assets: { "package-theme.css": styles } };
    },
  };
}
