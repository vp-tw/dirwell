import { randomBytes } from "node:crypto";
import { createExplorerHandler } from "@dirwell/server";

/** The host resolves a current session scoped to this fixed approved root. */
export async function createPrivateDownloads({
  root,
  theme,
  getSession,
  intervalMs = 1000,
  exclude = [],
  search = false,
}) {
  if (typeof getSession !== "function") throw new TypeError("getSession must be a function");
  const allowed = async (request) => {
    const session = await getSession(request);
    return Boolean(
      session &&
      session.canDownload === true &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now(),
    );
  };
  const handler = await createExplorerHandler({
    root,
    theme,
    mountPath: "/downloads",
    files: "attachment",
    exclude,
    search,
    live: { intervalMs, maxClients: 8 },
    authorize: allowed,
    headers: () => ({ "cache-control": "private, no-store" }),
  });
  return async (request) => {
    if (!(await allowed(request)))
      return new Response("Sign in through the host application", {
        status: 401,
        headers: { "cache-control": "private, no-store", "content-type": "text/plain" },
      });
    const browse = new URL(request.url).pathname.startsWith("/downloads/browse/");
    // A fresh nonce changes document bytes. Keep pre-nonce ETags out of document caching.
    let delegated = request;
    if (browse) {
      const headers = new Headers(request.headers);
      headers.delete("if-none-match");
      headers.delete("if-modified-since");
      delegated = new Request(request, { headers });
    }
    const response = await handler(delegated);
    if (
      !browse ||
      response.status !== 200 ||
      !response.headers.get("content-type")?.startsWith("text/html")
    )
      return response;
    const nonce = randomBytes(24).toString("base64");
    // Official renderer HTML is trusted; source names/data were escaped before this composition.
    const html =
      response.body === null
        ? null
        : (await response.text()).replace(
            /<(script|style)(?=[\s>])/gi,
            (_match, tag) => `<${tag} nonce="${nonce}"`,
          );
    const headers = new Headers(response.headers);
    for (const key of ["etag", "last-modified", "content-length"]) headers.delete(key);
    headers.set(
      "content-security-policy",
      [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "script-src-attr 'none'",
        `style-src-elem 'self' 'nonce-${nonce}'`,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
