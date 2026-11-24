# House view — design preview

A local, read-only research desk with four sections: Overview, Layers, Timeline, and House rules. A Notes drawer is a fifth surface, not a fifth tab.

This is a design preview for review. It is not published, not a trading screen, and not the full message archive.

The paper-experiment gallery in `/docs` is a different site. This branch does not change it.

## Run locally

From this directory:

```bash
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/

Use a local server. Opening `index.html` as a file will not load the modules. There is no build step and no install.

Tests, from this directory:

```bash
node --test
```

## What you are looking at

- **Overview** — house thesis, ideas under pressure, a short sublayer pulse, and the strongest counter-view. The latest observation date is 24 Nov 2026. Send times were not supplied, so the preview does not show a clock time.
- **Layers** — five layers and their sublayers. Names are examples of a mechanism. They are not holdings, weights, or recommendations. Empty boxes stay empty. GEV is electrical equipment (1b), not a power producer. AVGO’s primary category is 2a, with a 2c cross-tag so it is not counted twice.
- **Timeline** — seven scouts from 21–24 Nov 2026. Filter by date, type, layer, and verdict, and search the wording. Briefs and alerts are in the filter so the empty state is visible. Cards open into reported fact, inference, counter-view, unknowns, and sources.
- **House rules** — how claims are read, and what this desk does not do.
- **Notes** — one composer. “Add a note” on a section stores that section’s id and title. The header “Add a note” is a general note. The inbox groups notes already on this browser.

Notes use `localStorage` only. The drawer says: **Saved on this browser only — not sent to your advisor.** Status `saved` means stored here. This preview never marks a note reviewed, and it never contacts an advisor. Remove notes with “Remove notes from this browser”.

## Publishing

Do not deploy this preview. Do not merge it in order to put it on GitHub Pages.

`.github/workflows/rebuild-pages.yml` republishes the gallery only when a push to `main` touches `docs/**`, `scripts/**`, or that workflow. This preview lives in `thesis-preview/` so a push of this branch does not take that path. Keep it out of `/docs`.

A later home, if approved, is a new Cloudflare Workers Static Assets site, not a Pages migration of the gallery. The notes API and the full archive would be access-protected. See [CONTRACT.md](CONTRACT.md). No Wrangler config is included, on purpose.

## Privacy

The sample text is the supplied macro notes, phrased as reported observations. Link checks recorded whether a page responded. They did not re-verify the claims. One source (the Korea Economic Daily link) refused the check and is marked unconfirmed, not missing and not confirmed.

Do not add holdings, quantities, weights, purchase history, contact details, keys, or chat transcripts. Do not treat a note as permission to trade, send, or deploy.
