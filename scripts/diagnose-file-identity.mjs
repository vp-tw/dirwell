import { constants } from "node:fs";
import { open, lstat, realpath } from "node:fs/promises";
import { createDirectoryService } from "@dirwell/core";
const filename = "source/active.html",
  service = await createDirectoryService({ root: "source" });
const link = await lstat(filename),
  handle = await open(filename, "r");
try {
  const descriptor = await handle.stat();
  let guarded;
  try {
    const opened = await service.openFile("active.html");
    await opened.handle.close();
    guarded = "passed";
  } catch (error) {
    guarded = { name: error.name, message: error.message, code: error.code };
  }
  console.error(
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        noFollow: constants.O_NOFOLLOW ?? null,
        lstat: { dev: link.dev, ino: link.ino, isFile: link.isFile() },
        fstat: { dev: descriptor.dev, ino: descriptor.ino, isFile: descriptor.isFile() },
        path: await realpath(filename),
        guarded,
      },
      null,
      2,
    ),
  );
} finally {
  await handle.close();
}
