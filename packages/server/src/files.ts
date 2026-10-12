import { createHash } from "node:crypto";
import path from "node:path";
import type { DirectoryService } from "@dirwell/core";
export type FileServingMode = "media" | "attachment" | "inline";
const media: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
};
const other: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
const encodedFilename = (value: string) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
const matchesEtag = (request: Request, headers: Headers) =>
  request.headers
    .get("if-none-match")
    ?.split(",")
    .some(
      (value) =>
        value.trim() === "*" ||
        value.trim().replace(/^W\//, "") === headers.get("etag")?.replace(/^W\//, ""),
    );
export async function fileResponse(
  request: Request,
  logicalPath: string,
  service: DirectoryService,
  mode: FileServingMode,
  headersFor: (headers: Headers) => Promise<Headers>,
  authorize: (target: string) => Promise<boolean>,
): Promise<Response> {
  const source = await service.getEntry(logicalPath);
  const link = source.symlink;
  if (link && (link.isBroken || link.isOutsideRoot || link.isTargetExcluded)) {
    const headers = await headersFor(
      new Headers({
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename*=UTF-8''${encodedFilename(source.name + ".txt")}`,
        "x-content-type-options": "nosniff",
        etag: `"${createHash("sha256").update(link.target).digest("hex")}"`,
      }),
    );
    const matched = matchesEtag(request, headers);
    return new Response(matched || request.method === "HEAD" ? null : link.target, {
      status: matched ? 304 : 200,
      headers,
    });
  }
  if (link?.targetRelativePath && !(await authorize(link.targetRelativePath)))
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  const { entry, handle, canonicalPath } = await service.openFile(logicalPath);
  let handedOff = false;
  try {
    if (
      canonicalPath !== logicalPath &&
      canonicalPath !== link?.targetRelativePath &&
      !(await authorize(canonicalPath))
    )
      return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
    const stats = await handle.stat();
    const extension = path.extname(entry.name).toLowerCase();
    const disposition =
      mode === "inline" || (mode === "media" && media[extension] !== undefined)
        ? "inline"
        : "attachment";
    const filename = encodedFilename(source.name);
    const headers = await headersFor(
      new Headers({
        "content-type": media[extension] ?? other[extension] ?? "application/octet-stream",
        "content-disposition": `${disposition}; filename*=UTF-8''${filename}`,
        "x-content-type-options": "nosniff",
        "accept-ranges": "bytes",
        "last-modified": stats.mtime.toUTCString(),
        etag: `W/"${stats.size}-${stats.mtimeMs}"`,
      }),
    );
    if (matchesEtag(request, headers)) return new Response(null, { status: 304, headers });
    let start = 0,
      end = stats.size - 1,
      status = 200;
    const range = request.headers.get("range");
    const ifRange = request.headers.get("if-range");
    if (
      request.method === "GET" &&
      range?.startsWith("bytes=") &&
      (!ifRange || (!ifRange.startsWith("W/") && ifRange === headers.get("etag")))
    ) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (!match[1]) start = Math.max(0, stats.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
      } else {
        start = -1;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start > end ||
        start >= stats.size
      ) {
        headers.set("content-range", `bytes */${stats.size}`);
        return new Response(null, { status: 416, headers });
      }
      status = 206;
      headers.set("content-range", `bytes ${start}-${end}/${stats.size}`);
    }
    headers.set("content-length", String(Math.max(0, end - start + 1)));
    if (request.method === "HEAD") return new Response(null, { status, headers });
    let position = start,
      closed = false;
    const close = async () => {
      if (!closed) {
        closed = true;
        request.signal.removeEventListener("abort", abort);
        await handle.close();
      }
    };
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const abort = () => {
      streamController.error(new DOMException("Aborted", "AbortError"));
      void close();
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        request.signal.addEventListener("abort", abort, { once: true });
      },
      async pull(controller) {
        try {
          if (request.signal.aborted) {
            abort();
            return;
          }
          if (position > end) {
            await close();
            controller.close();
            return;
          }
          const buffer = new Uint8Array(Math.min(64 * 1024, end - position + 1));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
          if (bytesRead === 0) throw new Error("File changed while reading");
          position += bytesRead;
          controller.enqueue(buffer.subarray(0, bytesRead));
        } catch (error) {
          await close();
          controller.error(error);
        }
      },
      async cancel() {
        await close();
      },
    });
    handedOff = true;
    return new Response(body, { status, headers });
  } finally {
    if (!handedOff) await handle.close();
  }
}
