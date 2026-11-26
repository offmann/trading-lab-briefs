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

- **Overview** — concise house thesis (with expandable full six-tenet text and counter-view), an activity timeline strip whose date range is taken from `content/archive.json`, the interactive **Five-Layer AI Infrastructure Cake** (`L5` Applications down to `L1` Physical foundation, coloured by heat with bottleneck markers and clickable sublayer signal inspectors), four **What Changed This Week** version cards (`v1`–`v4`), and the **Theses Scoreboard** as interactive visual chips (`Strengthened`, `Qualified / Eased`, `Open / Watch`).
- **Feed** — all sanitized items in the archive coverage window (`meta.coverage`) (`brief`, `scout`, `evening`, `thinkers`, `thesis-change`), grouped newest-day-first with type icons, stance badges, layer tags, 3–5 bullets, counter-view callout, and source links. Clicking any card opens a dedicated, distraction-free **Message Detail Reader**. Includes a compact secondary filter bar (type chips, layer chips, text search) collapsed by default on mobile, with no from/to date pickers.
- **Rules** — the four house-rule groups rendered as visual cards alongside an evidence and map discipline key.
- **Notes** — unobtrusive slide-over composer. Notes are stored in a private Cloudflare database behind `/api/notes`, not in the public pages. On first unlock, any leftover browser-only notes are migrated up.

## Content bundle

All public copy is read from [`content/archive.json`](content/archive.json) (documented in [`content/README.md`](content/README.md)). Tickers are macro examples of a mechanism — never holdings, quantities, weights, or trade recommendations. Scout items whose clock times were not recorded keep `sentAt: null` and never invent a timestamp.

## Cloudflare Workers Static Assets directory

This folder is a **Cloudflare Workers Static Assets** site with a small Worker for the private notes API and no front-end build step:

- **Assets directory** (inside this folder): `public/` (`index.html`, `css/`, `js/`, `content/archive.json`).
- **Worker**: `src/worker.js` handles only `/api/*` via `assets.run_worker_first`.
- **Wrangler config**: `wrangler.jsonc` binds the notes KV namespace. It does not contain secrets. Pushing this folder does not trigger `.github/workflows/rebuild-pages.yml` (which watches `docs/**` and `scripts/**` only). See [`CONTRACT.md`](CONTRACT.md) for the notes access boundary.
