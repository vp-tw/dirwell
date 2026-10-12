const paths = {
  directory: '<path d="M3 7V5h6l2 3h10v12H3Z"/><path d="M3 10h18"/>',
  file: '<path d="M5 3h9l5 5v13H5ZM14 3v5h5M8 12h8M8 16h6"/>',
  link: '<path d="m9 15 6-6M8 10l-3 3a4 4 0 0 0 6 6l3-3M10 8l3-3a4 4 0 0 1 6 6l-3 3"/>',
};
/** Fixed authored geometry; source names and paths never enter SVG markup. */
export function entryIcon(kind: keyof typeof paths): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
