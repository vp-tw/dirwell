export type CrosswaveIcon =
  | "all"
  | "folder"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "other"
  | "link"
  | "back"
  | "search"
  | "pause"
  | "play"
  | "controller";

const paths: Record<CrosswaveIcon, string> = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  folder:
    '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M3 9h18"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  audio:
    '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>',
  video: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="m10 8 6 4-6 4Z"/>',
  document: '<path d="M5 3h9l5 5v13H5ZM14 3v5h5M8 12h8M8 16h6"/>',
  other: '<path d="m12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9"/>',
  link: '<path d="m9 15 6-6M8 10l-3 3a4 4 0 0 0 6 6l3-3M10 8l3-3a4 4 0 0 1 6 6l-3 3"/>',
  back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  controller:
    '<path d="M7 7h10c3 0 4 3 5 9 0 3-2 4-4 1l-2-2H8l-2 2c-2 3-4 2-4-1 1-6 2-9 5-9ZM6 11h4M8 9v4M16 10h.01M19 13h.01"/>',
};

/** Original geometric icons, not copied console artwork. */
export function crosswaveIcon(name: CrosswaveIcon): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
