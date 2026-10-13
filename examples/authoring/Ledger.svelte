<script lang="ts">
  import Ledger from "@dirwell/theme-ledger/source";
  import type { ThemePage } from "@dirwell/theme-ledger/model";
  let { model }: { model: ThemePage } = $props();
</script>
<Ledger {model}>
  {#snippet header({ model: page })}<h1 data-custom-header>{page.title} · My archive</h1>{/snippet}
  {#snippet row({ entry })}<span data-custom-row>{entry.name}</span>{/snippet}
  {#snippet footer({ model: page })}<p data-custom-footer>{page.total} entries · Arrow keys navigate</p>{/snippet}
</Ledger>
<style>h1 { color: #315b85; } [data-custom-row] { font-weight: 600; }</style>
