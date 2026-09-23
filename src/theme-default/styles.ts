export const defaultStyles = `
:root {
  color-scheme: light dark;
  --dw-control-height: 2.75rem;
  --paper: #f3f0e8;
  --surface: #fbfaf6;
  --ink: #171815;
  --muted: #64655f;
  --rule: #c9c5ba;
  --soft-rule: #e3dfd5;
  --accent: #174ea6;
  --accent-strong: #103973;
  --focus: #005fcc;
  --hover: #f0eee7;
  --control: #fff;
  --status: #34705c;
  --warning: #9a4616;
  --shadow: 0 30px 80px rgba(46, 46, 40, 0.14);
}
:root[data-theme="light"] {
  color-scheme: light;
  --paper: #f3f0e8;
  --surface: #fbfaf6;
  --ink: #171815;
  --muted: #64655f;
  --rule: #c9c5ba;
  --soft-rule: #e3dfd5;
  --accent: #174ea6;
  --accent-strong: #103973;
  --focus: #005fcc;
  --hover: #f0eee7;
  --control: #fff;
  --status: #34705c;
  --warning: #9a4616;
  --shadow: 0 30px 80px rgba(46, 46, 40, 0.14);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --paper: #11130f;
  --surface: #191b17;
  --ink: #f2f0e8;
  --muted: #b1b4ab;
  --rule: #474a42;
  --soft-rule: #30332d;
  --accent: #91bff0;
  --accent-strong: #b7d5f4;
  --focus: #78b7f4;
  --hover: #22251f;
  --control: #10120f;
  --status: #8bc0aa;
  --warning: #f0a06d;
  --shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    --paper: #11130f;
    --surface: #191b17;
    --ink: #f2f0e8;
    --muted: #b1b4ab;
    --rule: #474a42;
    --soft-rule: #30332d;
    --accent: #91bff0;
    --accent-strong: #b7d5f4;
    --focus: #78b7f4;
    --hover: #22251f;
    --control: #10120f;
    --status: #8bc0aa;
    --warning: #f0a06d;
    --shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
  }
}
* {
  box-sizing: border-box;
}
html {
  min-height: 100%;
  background: var(--paper);
  color: var(--ink);
}
body {
  min-width: 0;
  margin: 0;
  padding: clamp(1rem, 5vw, 4rem);
  font:
    15px/1.45 ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  font-variant-numeric: tabular-nums;
}
button,
input,
select {
  font: inherit;
}
main {
  width: min(72rem, 100%);
  margin: 0 auto;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 0.875rem;
  box-shadow: var(--shadow);
  overflow: visible;
}
.chrome {
  display: flex;
  min-height: 3.4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1.4rem;
  border-bottom: 1px solid var(--soft-rule);
}
.breadcrumbs {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.15rem;
  font-size: 0.95rem;
  font-weight: 650;
}
.breadcrumbs a,
.breadcrumbs span {
  color: inherit;
}
.breadcrumbs a {
  color: var(--accent);
  text-decoration-thickness: 0.08em;
  display: inline-flex;
  min-height: var(--dw-control-height);
  align-items: center;
  padding: 0 0.2rem;
}
.separator {
  display: inline-flex;
  color: var(--muted);
  font-weight: 400;
}
.summary {
  margin: 0;
  color: var(--muted);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.4rem;
  align-items: flex-start;
}
.search-cluster {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 0.6rem;
  align-items: center;
}
.search {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: min(28rem, 100%);
  min-height: var(--dw-control-height);
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: var(--control);
}
.search:focus-within {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
.search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
}
.search input::placeholder {
  color: var(--muted);
  opacity: 1;
}
.compact-select,
.include-links {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--muted);
  font-size: 0.78rem;
}
.compact-select select,
.sort-menu select {
  min-height: var(--dw-control-height);
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: var(--control);
  color: var(--ink);
  padding: 0.35rem 1.8rem 0.35rem 0.55rem;
}
.include-links[hidden] {
  display: none;
}
.include-links {
  min-height: var(--dw-control-height);
}
.toolbar-actions {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
.scheme {
  display: flex;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  outline: 1px solid var(--rule);
  outline-offset: -1px;
}
.scheme button {
  min-height: var(--dw-control-height);
  border: 0;
  border-radius: 0.34rem;
  padding: 0.35rem 0.65rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.scheme button:hover {
  color: var(--ink);
}
.scheme button[aria-pressed="true"] {
  background: var(--ink);
  color: var(--surface);
}
.sort-panel {
  position: relative;
}
.sort-panel > summary {
  display: flex;
  min-height: var(--dw-control-height);
  align-items: center;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: var(--control);
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}
.sort-panel > summary::-webkit-details-marker {
  display: none;
}
.sort-panel[open] > summary {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
.sort-menu {
  position: absolute;
  z-index: 2;
  right: 0;
  top: calc(100% + 0.4rem);
  display: grid;
  width: 16rem;
  gap: 0.7rem;
  padding: 1rem;
  border: 1px solid var(--rule);
  border-radius: 0.75rem;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.sort-menu label {
  display: grid;
  gap: 0.3rem;
  color: var(--muted);
  font-size: 0.76rem;
}
.sort-menu label[hidden] {
  display: none;
}
.sort-menu label:last-child {
  display: flex;
  align-items: center;
  color: var(--ink);
}
.entry-head,
.entry {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(8rem, auto) 12rem;
  gap: 1.25rem;
}
.entry-head {
  min-height: var(--dw-control-height);
  align-items: center;
  padding: 0 1.4rem;
  border-top: 1px solid var(--soft-rule);
  border-bottom: 1px solid var(--soft-rule);
  background: var(--paper);
}
.sort-heading {
  display: inline-flex;
  min-height: var(--dw-control-height);
  align-items: center;
  width: max-content;
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 0;
  font-size: 0.68rem;
  font-weight: 720;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  cursor: pointer;
}
button.sort-heading {
  min-width: var(--dw-control-height);
}
.sort-heading[aria-pressed="true"] {
  color: var(--accent);
}
.entries {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry {
  min-height: 3.25rem;
  align-items: center;
  padding: 0.72rem 1.4rem;
  border-bottom: 1px solid var(--soft-rule);
}
.entry:hover,
.entry[data-active="true"] {
  background: var(--hover);
}
.entry[hidden] {
  display: none;
}
a {
  color: var(--accent);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.22em;
}
.identity {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  column-gap: 0.65rem;
}
.entry-name {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}
.name {
  font-weight: 650;
  overflow-wrap: anywhere;
}
.icon {
  display: inline-block;
  flex: none;
  vertical-align: -0.15em;
  color: var(--status);
}
.target {
  color: var(--muted);
  font:
    500 0.8rem/1.6 ui-monospace,
    SFMono-Regular,
    monospace;
  overflow-wrap: anywhere;
}
.target-label {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 650;
}
.unavailable {
  color: var(--muted);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.kind,
time {
  color: var(--muted);
  font-size: 0.82rem;
}
.badge {
  display: inline-block;
  margin-right: 0.5rem;
  padding: 0.08rem 0.4rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 0.72rem;
}
.warning {
  color: var(--warning);
}
a:focus-visible,
button:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.empty {
  margin: 0;
  padding: 2rem 1.4rem;
  color: var(--muted);
  border-bottom: 1px solid var(--soft-rule);
}
::selection {
  background: var(--accent);
  color: var(--surface);
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.4rem;
  color: var(--muted);
  font-size: 0.78rem;
}
.project-meta,
.shortcuts {
  margin: 0;
}
.project-meta a {
  margin-left: 0.55rem;
}
.shortcuts {
  text-align: right;
}
kbd {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 0.12rem;
  padding: 0.02rem 0.3rem;
  border: 1px solid var(--rule);
  border-radius: 0.2rem;
  background: var(--control);
  text-align: center;
  font: inherit;
}
.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.sort-heading:not(button) {
  cursor: default;
}
@media (max-width: 60rem) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .search-cluster {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .search {
    width: 100%;
  }
  .compact-select {
    flex: 1;
  }
  .compact-select select {
    width: 100%;
  }
  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
  .sort-menu {
    right: auto;
    left: 0;
  }
}
@media (max-width: 42rem) {
  body {
    padding: 0;
    background: var(--surface);
  }
  main {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .chrome {
    padding-inline: 1rem;
  }
  .toolbar {
    padding: 1rem;
  }
  .compact-select select {
    width: 100%;
  }
  .entry-head {
    display: none;
  }
  .entry {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.25rem 1rem;
    padding: 0.78rem 1rem;
  }
  .entry .name {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
  }
  .entry time {
    grid-column: 1/-1;
  }
  .kind {
    text-align: right;
  }
  footer {
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 1.1rem 1rem;
  }
  .project-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem;
  }
  .project-meta a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    margin-left: 0;
  }
  .shortcuts {
    margin: 0;
    text-align: left;
  }
}
@media (max-width: 19.5rem) {
  .search-cluster {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .compact-select {
    width: 100%;
  }
  .toolbar-actions {
    flex-wrap: wrap;
  }
  .sort-menu {
    width: min(16rem, calc(100vw - 2rem));
  }
}
@media (pointer: coarse) {
  .entry .name,
  .project-meta a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }
}
`;
