# @dirwell/theme-ledger

Private alpha workspace. Svelte owns the server markup, client state, keyed rows, search, sorting, dialogs, navigation and cleanup. No framework-neutral serialized UI tree or imperative theme controller is used.

Use `createLedgerTheme({ title: "Sample downloads" })` with `@dirwell/core` and an explicit listing policy. Paged HTML preserves native links without JavaScript. The browser loads and validates the complete compact listing before enabling directory-wide search and sorting; directories exceeding 500 visible rows use measured row virtualization. Folder snapshots resolve navigation URLs before updating History.

The current alpha surface includes directory type filtering, fuzzy search, name/size/modified sorting, natural/locale/Unicode names, color schemes, timestamp details, archive search, and keyboard selection. Legacy project/label/component overrides are not yet a migration contract. File URLs use native navigation and pagination.

The package contains a separately compiled classic browser script and Node server renderer. Svelte is a dependency of this theme, not core or Plain. No Open Graph image implementation is bundled.

## Component source

Import the official component from this package's `/source` entry and model/row
types from `/model`. Use `@dirwell/theme-authoring` to compile the same wrapper
for SSR and client, or its `/dev` entry for trusted local HMR. Header, row content
and footer are customizable; official navigation and interaction ownership is
retained. See [the authoring guide](../theme-authoring/README.md).
