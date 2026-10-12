# @dirwell/theme-crosswave

Private alpha workspace. Vue owns the server markup, reactive category/search/selection state, keyed media rows, folder navigation, appearance and teardown. VueUse `useGamepad` supplies gamepad polling; the theme scopes keyboard listeners, graphics, polling and clocks to the component lifecycle.

Use `createCrosswaveTheme({ title: "Sample media files" })` with `@dirwell/core` and an explicit listing policy. Paged HTML preserves native links without JavaScript. Complete compact listing data is validated before category filtering and search become available. MIME classification runs in Node and publishes small category IDs; no MIME database is sent to the browser.

Options include custom categories, color, gamepad controls and background motion. The legacy component/project customization surface is not yet a migration contract. Physical gamepads remain unverified. File URLs use native links and pagination.

Vue, VueUse and the browser graphics code belong to this theme only. No Open Graph image implementation is bundled.
