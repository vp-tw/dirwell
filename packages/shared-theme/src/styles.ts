export const ledgerAdjustments = `
.page-header{width:min(72rem,100%);margin:0 auto 1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.5rem 1.4rem}
.wordmark{display:flex;align-items:baseline;gap:1rem}.wordmark h1{font-size:1.2rem;margin:0}.wordmark span{font-size:.8rem;color:var(--muted)}
.toolbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:.8rem}
.toolbar>label{display:flex;flex-direction:column;gap:.3rem;font-size:.8rem;color:var(--muted);min-width:0}
.toolbar input[type=search],.toolbar select,.toolbar>button{min-height:44px;border:1px solid var(--rule);border-radius:6px;background:var(--control);color:var(--ink);padding:.5rem .6rem;min-width:0;width:100%}
.toolbar .search-field{grid-column:span 2}.toolbar fieldset{grid-column:span 2;border:1px solid var(--rule);border-radius:6px;margin:0;min-height:44px;padding:.4rem .6rem;display:flex;flex-wrap:wrap;gap:.7rem;font-size:.8rem}.toolbar fieldset legend{color:var(--muted)}
.toolbar fieldset label{display:flex;align-items:center;gap:.35rem;min-height:32px}.toolbar>label:has(input[type=checkbox]){flex-direction:row;align-items:center;align-self:end;min-height:44px}
.toolbar button{align-self:end;cursor:pointer}.listing-summary{padding:.7rem 1.4rem;color:var(--muted);font-size:.85rem;display:flex;gap:.6rem;flex-wrap:wrap}
.entry-list{padding-inline:1.4rem}.entry{min-height:76px;box-sizing:border-box}.entry .identity{min-width:0}.file-icon{display:inline-flex;width:18px;height:18px;vertical-align:middle;margin-right:.35rem}.file-icon svg{width:100%;height:100%}
.keyboard-help{padding-inline:1.4rem;font-size:.8rem;color:var(--muted)}
dialog{max-width:min(42rem,90vw);max-height:80vh;border:1px solid var(--rule);border-radius:12px;background:var(--surface);color:var(--ink);padding:1.5rem}dialog::backdrop{background:#0006}
@media(max-width:42rem){.page-header{padding:1rem;display:block}.wordmark{flex-wrap:wrap;gap:.4rem}.toolbar{grid-template-columns:repeat(2,minmax(0,1fr));padding:1rem;gap:.6rem}.toolbar .search-field,.toolbar fieldset{grid-column:1/-1}.entry-list{padding-inline:1rem}.listing-summary{padding-inline:1rem}}
`;
export const crosswaveAdjustments = `
.cw-directory{flex-wrap:wrap;gap:.35rem}.cw-list-head h2{font-size:17px;font-weight:400;margin:0}.cw-list-head [data-cw-count]{font-size:12px;color:var(--cw-muted)}
.cw-motion{display:flex;align-items:center;background:transparent;border:1px solid #d7e9ff33;border-radius:4px;font-size:12px;min-height:44px;padding:6px 12px;white-space:nowrap}
.cw-appearance{min-width:0}.cw-appearance select{max-width:116px}
@media(max-width:680px){.cw-bottom{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px}.cw-appearance{width:auto;justify-content:flex-start;gap:12px}.cw-motion{max-width:140px;white-space:normal}.cw-list-head{align-items:start}}
`;
