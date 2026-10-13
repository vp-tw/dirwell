# Explorer experience

Plain is the CLI default: native links, timestamps and pagination with no browser runtime. Ledger adds Svelte search/sort, keyboard selection, dialogs and large-list virtualization. Crosswave adds Vue media categories, continuous navigation and gamepad input. See [the theme guide](docs/src/content/docs/themes.md).

Rich clients load complete coherent directory data before directory-wide filtering. Native HTML pagination remains available without JavaScript. Data blocks, HTML publication and DOM windowing are independent policies. Static Ledger can search the archive; live mode has directory search only.

Static output updates after rebuilds. Live server reads facts on requests; optional SSE refresh preserves search after a complete-data update. Files that vanish during a read are skipped, while permission/path errors remain visible. Theme source changes need compilation and a fresh renderer, or the separate authoring HMR service.

Plain requires refresh/navigation for new data. Live media previews use safe defaults; active files download. Broken, excluded and outside-root links remain unavailable. Core supplies safe navigation facts and themes own presentation. Physical-device qualifications remain bounded by [verification](VERIFICATION.md).
