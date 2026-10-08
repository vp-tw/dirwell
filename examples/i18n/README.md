# Theme-owned localization

This independent renderer demonstrates English, Traditional Chinese (`zh-TW`),
and Japanese (`ja`) without adding localization to Dirwell's core or built-in
themes. It owns the dictionaries, language selector, count messages, formatting,
and optional browser preference.

Run from the repository root:

```sh
pnpm dirwell build files -o ../../generated-i18n --cwd examples/i18n
```

The site build publishes the configured output beneath `examples/i18n/`.
`translations.ts` checks that every language defines the same message keys.
`runtime.js` applies messages as text, sets the document language and accessible
labels, formats local dates and binary file sizes, and persists a valid language
choice. Storage denial falls back to a working language selector.

The static document contains a complete English listing and labeled UTC dates.
Without JavaScript, language switching is hidden and navigation still works.
The example intentionally does not reproduce Ledger's search, sorting, or
virtualization. File names, contents, and links are independent of locale.
