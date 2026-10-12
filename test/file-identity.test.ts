import assert from "node:assert/strict";
import test from "node:test";
import { fileIdentityMatches } from "../packages/core/src/file-identity.ts";

test("Windows path stats without device IDs still require matching nonzero file IDs", () => {
  assert.equal(
    fileIdentityMatches(
      { device: 0, inode: 281474977636589 },
      { dev: 2183140038, ino: 281474977636589 },
      "win32",
    ),
    true,
  );
  assert.equal(fileIdentityMatches({ device: 0, inode: 7 }, { dev: 8, ino: 9 }, "win32"), false);
  assert.equal(fileIdentityMatches({ device: 0, inode: 0 }, { dev: 8, ino: 0 }, "win32"), false);
  assert.equal(fileIdentityMatches({ device: 4, inode: 7 }, { dev: 8, ino: 7 }, "win32"), false);
});
test("Unix device checks and stable full file identities remain strict", () => {
  for (const platform of ["linux", "darwin"] as const) {
    assert.equal(fileIdentityMatches({ device: 0, inode: 7 }, { dev: 8, ino: 7 }, platform), false);
    assert.equal(fileIdentityMatches({ device: 8, inode: 7 }, { dev: 8, ino: 7 }, platform), true);
    assert.equal(fileIdentityMatches({ device: 8, inode: 7 }, { dev: 8, ino: 9 }, platform), false);
  }
});
