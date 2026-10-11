# Dirwell brand artwork

The approved paper bird is the original transparent candidate 3A. The same original PNG is used in the website hero and header and documentation header. The README uses the approved white publishing cover below. Preserve its bytes and full canvas. The favicon uses a separate, minimally adjusted image-tool master of that same bird, with tighter framing and sturdier contours. Its transparent 16px, 32px, and 48px exports retain the complete character. See [favicon provenance](./favicon-provenance.json).

## Share images

The three original complete covers, including illustration, lettering, and composition, were generated in one image-tool call per candidate using the approved bird as the reference. The approved dark alternate was then edited in the image tool to add a warm-cream paper disk behind the feet; no lettering or layout was changed manually. Postprocessing only scales the canvas proportionally and saves it as lossless PNG. There is no cropping, compositing, or typesetting after generation.

The selected publishing source is 1730 × 909. Proportional scaling into a 1200 × 630 bound produces 1199 × 630; metadata reports those actual dimensions. The revised dark source is 1731 × 909 and exports at 1200 × 630.

### Publishing — selected

![Dirwell publishing share image](./dirwell-og.png)

The sentence states the input and result directly: “Turn a folder into a searchable website.” The index sheets connect the bird to publishing files.

### Editorial — alternate

![Dirwell editorial share image](./og-editorial.png)

### Dark paper-disk cover — alternate

![Dirwell dark cover with a warm-cream paper disk behind the bird’s black feet](./og-dark.png)

The disk improves foot contrast without recoloring the bird. This is an optional alternate; the white publishing cover remains the default. The localized image-tool edit is recorded in [dark-circle provenance](./dark-circle-provenance.json).

Exact prompts, the reference, and processing limits are recorded in [provenance.json](./provenance.json). The `*-source.png` files preserve every generated canvas for future proportional exports. Keep shared site metadata in [`docs/site-branding.mjs`](../../docs/site-branding.mjs); explorer themes retain their own configurable share images.

## GitHub and npm README

The root README embeds `assets/brand/dirwell-og.png` through its absolute GitHub raw URL. Both GitHub and npm can load the image without a local checkout or packaged artwork. The cover is byte-identical to [`docs/public/brand/dirwell-og.png`](../../docs/public/brand/dirwell-og.png), the official-site OG asset. Keep both copies synchronized when an approved cover replaces it.

The dark cover stays available here as an alternate; the README and official-site metadata use the white cover. This folder is not included in the npm package. To update the README shown on npm, publish a new package version.
