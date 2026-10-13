<script lang="ts">
  import Ledger from "@dirwell/theme-ledger/source";
  import type { ThemePage, ListingEntry } from "@dirwell/theme-ledger/model";
  import lattefile from "./icons/latte/_file.svg?raw";
  import lattefolder from "./icons/latte/_folder.svg?raw";
  import lattemarkdown from "./icons/latte/markdown.svg?raw";
  import lattetypescript from "./icons/latte/typescript.svg?raw";
  import lattetext from "./icons/latte/text.svg?raw";
  import lattezip from "./icons/latte/zip.svg?raw";
  import macchiatofile from "./icons/macchiato/_file.svg?raw";
  import macchiatofolder from "./icons/macchiato/_folder.svg?raw";
  import macchiatomarkdown from "./icons/macchiato/markdown.svg?raw";
  import macchiatotypescript from "./icons/macchiato/typescript.svg?raw";
  import macchiatotext from "./icons/macchiato/text.svg?raw";
  import macchiatozip from "./icons/macchiato/zip.svg?raw";
  let { model }: { model: ThemePage } = $props();
  function icon(entry: ListingEntry, flavor: "latte" | "macchiato") {
    const icons =
      flavor === "latte"
        ? {
            file: lattefile,
            folder: lattefolder,
            md: lattemarkdown,
            ts: lattetypescript,
            txt: lattetext,
            zip: lattezip,
          }
        : {
            file: macchiatofile,
            folder: macchiatofolder,
            md: macchiatomarkdown,
            ts: macchiatotypescript,
            txt: macchiatotext,
            zip: macchiatozip,
          };
    if (entry.kind === "directory" || entry.link?.targetKind === "directory")
      return icons.folder;
    const extension = entry.name.split(".").at(-1);
    return icons[extension as keyof typeof icons] ?? icons.file;
  }
</script>

<Ledger {model}>
  {#snippet header({ model: page })}<h1>Catppuccin explorer</h1>
    <p>{page.title} · Latte / Macchiato</p>{/snippet}
  {#snippet row({ entry })}<span class="custom-file-icon file-icon--light"
      >{@html icon(entry, "latte")}</span
    ><span class="custom-file-icon file-icon--dark"
      >{@html icon(entry, "macchiato")}</span
    ><span>{entry.name}</span>{/snippet}
</Ledger>

<style>
  :global(:root[data-theme="light"]),
  :global(:root[data-theme="system"]) {
    --paper: #e6e9ef;
    --surface: #eff1f5;
    --ink: #4c4f69;
    --muted: #6c6f85;
    --rule: #bcc0cc;
    --soft-rule: #ccd0da;
    --accent: #7c2ce0;
    --accent-strong: #6d29c6;
    --focus: #7c2ce0;
    --hover: #dce0e8;
    --control: #eff1f5;
    --status: #40a02b;
    --warning: #d20f39;
  }
  :global(:root[data-theme="dark"]) {
    --paper: #1e2030;
    --surface: #24273a;
    --ink: #cad3f5;
    --muted: #a5adcb;
    --rule: #494d64;
    --soft-rule: #363a4f;
    --accent: #8aadf4;
    --accent-strong: #b7bdf8;
    --focus: #8aadf4;
    --hover: #363a4f;
    --control: #1e2030;
    --status: #a6da95;
    --warning: #ed8796;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root[data-theme="system"]) {
      --paper: #1e2030;
      --surface: #24273a;
      --ink: #cad3f5;
      --muted: #a5adcb;
      --rule: #494d64;
      --soft-rule: #363a4f;
      --accent: #8aadf4;
      --accent-strong: #b7bdf8;
      --focus: #8aadf4;
      --hover: #363a4f;
      --control: #1e2030;
      --status: #a6da95;
      --warning: #ed8796;
    }
  }
  .custom-file-icon {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.5rem;
  }
  :global(.custom-file-icon svg) {
    width: 100%;
    height: 100%;
  }
  .file-icon--dark {
    display: none;
  }
  :global([data-theme="dark"]) .file-icon--light {
    display: none;
  }
  :global([data-theme="dark"]) .file-icon--dark {
    display: inline-flex;
  }
  @media (prefers-color-scheme: dark) {
    :global([data-theme="system"]) .file-icon--light {
      display: none;
    }
    :global([data-theme="system"]) .file-icon--dark {
      display: inline-flex;
    }
  }
</style>
