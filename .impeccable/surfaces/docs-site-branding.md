---
version: 1
slug: "docs-site-branding"
primary_target: "docs/src/pages/index.astro"
related_targets: ["README.md", "docs/astro.config.mjs", "docs/public/landing.css", "docs/site-branding.mjs", "docs/public/brand", "docs/brand/provenance.json", "docs/brand/favicon-provenance.json", "docs/brand/dark-circle-provenance.json"]
---

# Official project identity and sharing

Modes: Persuade for the landing page and share artwork; Read for the README and documentation. Approved identity extension within the existing warm paper, ink, deployment-blue, and editorial-type system. The user pins the original approved folded-paper bird as the main visual and permits a small-size adaptation of that same bird for the favicon. Generated explorers and independent themes retain their existing contracts and configurable branding.

The original `docs/public/brand/paper-bird.png` is a transparent 1254px square. Preserve its bytes and full canvas; do not simplify, redraw, crop, trim, or replace it. Display proportionally in the README at 160px, landing header at 36px square, and landing hero at up to 330px, reduced to 260px at the existing 850px stack breakpoint. The Starlight header uses that same image beside the title. The illustration's colors do not create new UI palette tokens. Favicon-only adaptation allows tighter framing and sturdier contours while retaining the complete bird, its pose, colors, eye, wing, beak, and both feet. The 1254px square master at `docs/brand/favicon-source.png` is an `image_gen` edit of the approved original. Export transparent 16px, 32px, and 48px PNGs; the landing page declares all three sizes and Starlight uses 48px. Do not modify the original mascot. See `docs/brand/favicon-provenance.json`.

The selected `docs/public/brand/dirwell-og.png` remains the white publishing-poster default share image, preserved byte for byte. Each candidate came from one `image_gen` call that included all typography, artwork, and composition with the approved bird reference. The selected 1730 × 909 output was proportionally resized to a lossless 1199 × 630 PNG. No post-generation compositing, cropping, lettering, or layout changes are allowed. The dark alternate includes the approved warm-cream oval paper disk behind its feet, added with a localized `image_gen` edit. Its 1731 × 909 edited source is proportionally resized to a lossless 1200 × 630 PNG, with no manual compositing, cropping, relettering, or further layout changes. See `docs/brand/dark-circle-provenance.json`. Alternate complete candidates and exact prompts are recorded in `docs/brand/provenance.json`.

`docs/site-branding.mjs` owns the shared description and share-image path, dimensions, and alternative text. Landing and Starlight metadata must resolve the official asset through the configured deployment base. README, favicon, responsive visual placement, and metadata asset existence are distinct acceptance checks; none by itself proves deployed social-platform cache refresh.
