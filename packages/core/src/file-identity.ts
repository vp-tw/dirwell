/** Some Windows Node/libuv versions omit the path-stat device ID but retain the file ID. */
export function fileIdentityMatches(
  before: { readonly device: number; readonly inode: number },
  descriptor: { readonly dev: number; readonly ino: number },
  platform = process.platform,
): boolean {
  if (before.inode !== descriptor.ino) return false;
  if (before.device === descriptor.dev) return true;
  return platform === "win32" && before.device === 0 && before.inode !== 0;
}
