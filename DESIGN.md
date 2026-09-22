# Default theme

The proof-of-concept theme treats a directory as an inventory sheet rather than
a generic dashboard. The path is the primary heading; entry metadata forms a
calm, high-density ledger below it.

The visual implementation is deliberately one theme implementation, not the
theme API. A third-party theme may replace the full document, add its own
assets, or render another component system without using these CSS variables.

The default theme uses neutral paper and ink surfaces, a restrained blue link
color, tabular numerals for measurements, strong keyboard focus, and a compact
responsive row layout. It has no external font or asset dependency.
