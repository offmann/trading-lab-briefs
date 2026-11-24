# House View (v2)

A visual, read-only AI infrastructure research desk built as plain static HTML, CSS, and ES modules with no build step.

The paper-experiment gallery in `/docs` is a separate site on GitHub Pages and is untouched by this folder.

## Run locally

From `thesis-preview/`:

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/` in a browser (use a local HTTP server rather than `file://` so ES modules and `content/archive.json` load over `fetch`).

Run the test suite from `thesis-preview/`:

```bash
node --test
```

## Views and structure

- **Overview** — concise house thesis (with expandable full six-tenet text and counter-view), an 8-day `17–24 Nov 2026` activity timeline strip, the interactive **Five-Layer AI Infrastructure Cake** (`L5` Applications down to `L1` Physical foundation, coloured by heat with bottleneck markers and clickable sublayer signal inspectors), four **What Changed This Week** version cards (`v1`–`v4`), and the **Theses Scoreboard** as interactive visual chips (`Strengthened`, `Qualified / Eased`, `Open / Watch`).
- **Feed** — all 26 sanitized items sent during `17–24 Nov 2026` (`brief`, `scout`, `evening`, `thinkers`, `thesis-change`), grouped newest-day-first with type icons, stance badges, layer tags, 3–5 bullets, counter-view callout, and source links. Clicking any card opens a dedicated, distraction-free **Message Detail Reader**. Includes a compact secondary filter bar (type chips, layer chips, text search) collapsed by default on mobile, with no from/to date pickers.
- **Rules** — the four house-rule groups rendered as visual cards alongside an evidence and map discipline key.
- **Notes** — unobtrusive slide-over composer backed by `localStorage` only, labelled **Saved on this browser only — not sent to your advisor.**

## Content bundle

All public copy is read from [`content/archive.json`](content/archive.json) (documented in [`content/README.md`](content/README.md)). Tickers are macro examples of a mechanism — never holdings, quantities, weights, or trade recommendations. Scout items whose clock times were not recorded keep `sentAt: null` and never invent a timestamp.

## Cloudflare Workers Static Assets directory

This folder is compatible out of the box with **Cloudflare Workers Static Assets** with zero build step:

- **Assets directory**: `thesis-preview` (when configured from the repository root, set `assets.directory` to `"./thesis-preview"`, or `"."` when configured inside `thesis-preview/`).
- **Served files**: `index.html`, `css/site.css`, `js/*.js`, and `content/archive.json` are all static assets referenced with relative URLs (`./` and `import.meta.url`), so no Worker script or bundler is required to render the site.
- No Wrangler configuration is committed in this repository on purpose, and pushing this folder does not trigger `.github/workflows/rebuild-pages.yml` (which watches `docs/**` and `scripts/**` only). See [`CONTRACT.md`](CONTRACT.md) for the future access-protected notes and private archive boundary.
