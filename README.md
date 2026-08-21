# GLM-4.6 Model Card

An interactive model card for **GLM-4.6**, Zhipu AI's open-weight mixture-of-experts language
model, in which every claim is tagged by how well it is actually sourced: developer-confirmed,
inferred from the GLM family, or never disclosed.

Prepared as coursework for Generative AI, August 2026. Not an official Zhipu AI publication.

## Contents

| File | What it is |
| --- | --- |
| `index.html` | The interactive card. Self-contained — open it directly, no build step. |
| `GLM-4.6-Model-Card.tex` | Full model documentation, `MC-GLM-4.6 Rev. 1.0`. Compiles on Overleaf with pdfLaTeX. |
| `GLM-4.6-Model-Card.pdf` | Export of the above. The download button on the page links to this file in this repo. |

## The page

Bento-grid glass UI, light and dark themes, keyboard-navigable for presenting (arrow keys step
between sections). The disclosure index counts the tagged claims in the page at runtime, so it
cannot drift from the content it summarises.

## Publishing

GitHub Pages serves this as-is: **Settings → Pages → Deploy from branch → `main` / root**.

The download button reads `PDF_HREF` near the top of the `<script>` block in `index.html`. It
points at the PDF in this repository, so the button works from the published page, from a local
copy, and from a shared link alike.
