# Public briefs site — information architecture

GitHub Pages serves `/docs` on `main` → https://offmann.github.io/trading-lab-briefs/

This file is for future agents. The reader of the live site is **not a trader**. Home is the **Investor** digest. They should see **when the site last published** (to the second), what $1,000 would have become vs hold, and then optionally ranks or individual briefs.

**Max 3 tabs.** Do not bring back Overview / Progress / Keepers as top-level nav.

## Pages

| File | Job | Answers |
|------|-----|---------|
| `index.html` | **Investor (home / default)** | Plain English: what was tested that matters, last updated to the second, what it means for an investor, and “$1,000 → $X vs hold over a clear timeframe.” Lead with the two big numbers when they still hold: BTC hold **$19,879** · ALGO KEEP **$10,663**. |
| `leaderboard.html` | Scoreboard + plot | Ranked paper strategies by sleeve (**BTC / ALGO / ETH**) vs buy&hold, KEEP/TWEAK/DROP. Plus a scatter: each point = an experiment; X = time; Y = paper end $ from $1,000. Sleeve filters; do not mix incompatible windows on one series. |
| `experiments.html` | Brief gallery | Dive into individual experiment cards. Revalidation + current KEEP/TWEAK first. Superseded / invalidated briefs in a collapsed **Superseded** section. |
| `investor.html` | Investor alias | Full duplicate of `index.html` (Investor tab current). Old `/investor.html` bookmarks always show content. |
| `progress.html`, `keepers.html` | Experiments aliases | Full 3-tab Experiments page plus a one-line “this address moved” note, then a short redirect to `experiments.html`. Never a blank stub. Not in primary nav. |
| `briefs/*.html` | Detail | One experiment. Compact top bar: **Back to Investor · Leaderboard · Experiments**. Do not unlist them. Do not resurrect Overview / Progress / Keepers. |

Hub pages use a **three-tab** nav: **Investor / Leaderboard / Experiments**. One row on a phone (~390px). Internal hub links carry `?v=20260909b`. Hub `<head>` includes `Cache-Control: no-cache` and a visible `build 20260909b` footer stamp.

## Copy rules (hubs)

- Shorten aggressively. Clarity > completeness. No jargon walls.
- **Do not** quote invalidated pre–look-ahead Donchian/SMA KEEP figures on hub pages (no $8.8M / $81.4M / $3.41M / SMA $124k, and no “ignore the million stuff because it was wrong” prose). If a number is wrong, omit it. Individual old briefs in `docs/briefs/` may keep historical pages.
- Privacy: paper **$1,000** only. No holdings, `RISK_PROFILE`, Revolut, or real portfolio $.

## Dates (required)

**Site last-updated** (Investor home, Leaderboard, Experiments kickers) must be **second precision**, like `2026-09-09 13:54:16 CEST` (Europe/Paris) — **not date-only**. Source of truth: the latest git commit that touched `docs/briefs/` (CI rebuild time is the fallback). CI writes this via `<!-- gallery:updated:start -->` … `end`.

Every **Experiments card** must show a clock **to the second**, like `2026-09-06 19:02:20 CEST` — in the card’s date chip **and** in a “Published …” summary line. The same stamp is written on each `docs/briefs/*.html` top meta row. **Never invent seconds** from a date-only filename. Source: `<!-- gallery-published iso source -->`, the first git add of that file, or **first-publish UTC now** when the brief is still untracked (CI copies, then rebuilds, then commits). Mapping: [`scripts/brief_timestamps.md`](../scripts/brief_timestamps.md). CI regenerates both surfaces via `format_updated_stamp` / `card_published_label`.

## Truth rails (post harness revalidation)

Verify from `docs/briefs/2026-09-09-harness-revalidation.html` — do not invent:

- **BTC bar = buy&hold** (~$19,879 from $1,000 on the revalidation full sample; deepest dip ~−76%).
- **Only active KEEP = Donchian 20/10 on ALGO** (~$10,663 vs ALGO hold ~$79).
- **ETH Donchian 10/5 = TWEAK** (still beats hold full-sample ~$31.8k vs ~$17.7k, but walk-forward fails — not KEEP).
- Paper-live books that started on old KEEP configs: history; revalidation supersedes those paper dollars.

## Leaderboard plot

Build from **post-revalidation / honest** paper end equities you can verify in published briefs (especially the revalidation brief). **Omit** invalidated pre–look-ahead figures. All honest comparable points today share one publish clock (`2026-09-09 13:54:16 CEST`) — do **not** fake a multi-day scatter. **All** = small multiples (BTC / ALGO / ETH), each with its **own linear $ scale**. Sleeve filter = one larger linear panel. X = paper end $ from $1,000 (lollipop). Y = ranked strategy. Hold = gray dashed reference. Palette: BTC amber, ALGO teal, ETH indigo. Shapes: KEEP ● / TWEAK ■ / DROP ○. Label the KEEP and the $ leader. Phone-first ~390px. Inline SVG/JS only.

## Verdict words (use these, not synonyms)

- **Keep** — keep as a *paper baseline or reference*. Never “go live.”
- **Tweak** — idea has a pulse; do not crown it; change the question or the knobs.
- **Drop** — this config or this use is done. Say what was dropped (defaults vs whole family).
- **Parked** — knobs were searched; stop the spiral; keep the write-up. Not a Drop. Use `.chip.park` / "Parked" everywhere — briefs included (copy `--chip-park` tokens from a hub page if the brief lacks them).

When a new brief lands, update:

1. Investor home if the $1,000 vs hold story changed *(hand-written)*
2. Leaderboard ranks / plot points if sleeve scores or verdicts changed *(hand-written)*
3. Experiments current vs superseded placement if a KEEP/TWEAK/DROP actually moved
4. The Experiments card lists and the last-updated stamp — **this step is CI**

## CI rebuild

`scripts/rebuild_gallery.py` keeps the public site in sync when briefs land.

**Preserve these markers** (the script fails if they are missing):

- `<!-- gallery:updated:start -->` … `<!-- gallery:updated:end -->` on Investor (`index.html`), Leaderboard, and Experiments (second-precision stamp)
- `<!-- gallery:briefs:start -->` … `<!-- gallery:briefs:end -->` on Experiments (**current** cards)
- `<!-- gallery:superseded:start -->` … `<!-- gallery:superseded:end -->` on Experiments (collapsed archive)
- `<!-- gallery:leaderboard-auto:start -->` … `<!-- gallery:leaderboard-auto:end -->` on Leaderboard (newer research drops after the revalidation day)

Do not delete them even when a region is empty.

- **Scans** `docs/briefs/*.html` (title, date, KEEP / TWEAK / DROP / PARKED from hero chips or takeaway chips). Optional override on a brief: `<!-- gallery-card title="…" chip="Keep" class="keep" teaser="$10,663 vs hold $79" lane="current" -->`. `lane="superseded"` demotes a new brief. The `teaser` is the one-line paper $ (or Day-0) line on Experiment cards. Never put an invented dollar figure in `teaser`.
- **Rewrites** the marked Experiments card lists and every `gallery:updated` kicker. Stamp format: `Updated 2026-09-09 13:54:16 CEST · hypothetical $1,000` from the latest `docs/briefs/` commit (override with `GALLERY_UPDATED_AT` or `SOURCE_DATE_EPOCH`). Cards show **full date** + chip + title + teaser. Existing card order is kept; new files are appended (current vs superseded: date before 9 Sep 2026, or paper-live, → superseded unless `lane` overrides). Revalidation is pinned first in Current.
- **Does not** overwrite Investor prose, leaderboard rank tables, or plot point data. Those stay editorial.
- **Leaderboard auto:** hand-written “latest beat” stays. Only briefs **after** 9 Sep 2026 that are not already linked get appended.
- **Scrub:** fails (or `--strip` redacts) if published hub pages or `briefs/*.{html,md}` contain `RISK_PROFILE`, `0.15 BTC`, Revolut holdings/balances, personal totals like `~$14k` / `$14k` / `~$14,000`, or “core wealth sleeve / accumulate bias”. Hypothetical paper `$1,000` / `$1000` is allowed, as is paper shorthand with a decimal (`~$10.2k`). `UX.md` / `README.md` are not scanned (they name the forbidden words).

Do **not** invent missing briefs for raw `experiments/runs/*` batches — those are already summarized in the published briefs.

Local:

```bash
python3 scripts/rebuild_gallery.py          # fail on leaks; rebuild hubs
python3 scripts/rebuild_gallery.py --check  # scan only
python3 scripts/rebuild_gallery.py --strip  # redact leaks, then rebuild
```

On push to `main` that touches `docs/briefs/**` or `scripts/**`, `.github/workflows/rebuild-pages.yml` runs the script with `--strip`. If `git diff` is non-empty, `github-actions[bot]` commits and GitHub Pages is asked to rebuild `/docs`. The same workflow runs `--check` on pull requests that touch those paths. `workflow_dispatch` rebuilds like a main push.

Still update Investor copy / leaderboard ranks and plot when the *research story* changes. CI only guarantees every brief has a dated card, the last-updated stamp has seconds, and the site is not leaking personal capital.

## Privacy (hard)

Publish **only**:

- Strategy concepts and plain-English rules  
- Paper findings vs **buy & hold**  
- Hypothetical **paper $1,000** (already the brief convention)  
- Keep / Tweak / Drop / Parked  
- Progress over time (on Leaderboard plot + Experiments cards)

Never publish:

- Real portfolio size, broker balances, or holdings  
- `RISK_PROFILE.md` or any personal risk-profile narrative  
- Planned live deployment amounts  
- “Core wealth sleeve / accumulate bias” personal framing  

Allowed generic constraint if needed: **spot-style / no leverage**. Prefer “go live” over naming a broker. Prefer “stay-invested style” over personal sleeve language.

Source markdown under `briefs/*.md` is also public (same `/docs` tree). Scrub it the same way.

## Design (visual-explainer)

- Self-contained HTML (inline CSS/JS). Phone-first, `rem` type scale, max width ~42rem.  
- Teal / slate dashboard. Fonts: **DM Sans** + **JetBrains Mono**. Not purple, not Inter.  
- Light + dark: `prefers-color-scheme` plus `data-theme` + `localStorage` key `tl-theme`.  
- Target ~390px width. Tap targets ≥2.75rem for the theme control; three hub tabs on one row.  
- Experiment teasers must remain readable at ~390px (wrap; do not hide them).  
- Copy tokens from `index.html` when adding a hub page. Do not introduce a bundler.

## Adding a brief

1. Drop the HTML (and optional `.md`) in `docs/briefs/`.  
2. Keep the existing teal/slate brief look.  
3. Prefer a `gallery-card` comment with `teaser` pulled from the brief’s own numbers. Add `lane="superseded"` if it should not lead.  
4. CI rebuilds Experiments cards and the second-precision stamp, and appends missing post-revalidation Leaderboard drops. Still hand-update Investor / leaderboard ranks / plot when the story changes.  
5. Re-read for privacy before merge (or rely on the scrub; do not put holdings in to “see if CI strips them”).

Private research code lives in `offmann/trading-lab`. Patterns only. Never copy holdings, risk profile, or capital targets into this repo.

## What “done” looks like for a visitor

Thirty seconds on Investor: two big paper numbers, **when the site last published (to the second)**, and “if I put $1,000 this way, ~$X vs hold ~$Y.” Leaderboard: ranked sleeves plus the $1,000 scatter. Experiments: current cards first, superseded collapsed — then they can ignore the tables.
