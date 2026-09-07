# Public briefs site — information architecture

GitHub Pages serves `/docs` on `main` → https://offmann.github.io/trading-lab-briefs/

This file is for future agents. The reader of the live site is **not a trader**. Lead with status, then offer detail. They should be able to see **when** each experiment happened and how hypothetical **$1,000** moved — not only Keep / Tweak / Drop chips.

## Pages

| File | Job | Answers |
|------|-----|---------|
| `index.html` | Overview | “What should I care about in under a minute?” KEEP / TWEAK / DROP / PARKED as it stands **now**, plus a slim champion handoff. |
| `progress.html` | Time-series | The primary timeline: date, step, verdict, title, learned blurb, paper $1,000 line. Champion strip lives here. |
| `keepers.html` | Survivors | What is still worth remembering, in plain English — and what Keep *does not* mean. |
| `briefs/*.html` | Detail | One experiment. Linked from the three hub pages. Do not unlist them. |

Do **not** go back to a flat card gallery as the homepage.

## Reader path

1. Overview status + family board  
2. Optional: Progress (time-series) or Keepers (why survivors survived)  
3. Optional: a single brief for tables  

Hub pages use a three-tab nav (Overview / Progress / Keepers). Briefs get a “← Lab overview” link only.

## Dates (required)

Every **Progress node** and every **Overview brief card** must show the experiment date in full, like `6 Sep 2026` — not `Sep 6`. Include time-of-day **only** if that clock is already written in the brief. Do not invent hours.

CI uses the same format (`scripts/rebuild_gallery.py` → `public_date_label`). Filename date (`2026-09-06-…`) is the fallback when the brief body has no date.

## Progress is the time-series surface

`progress.html` is where a non-trader watches **progress over time**. Each hand-written (or auto-appended) node shows, in this order:

1. Date  
2. Step label (`1 · Screen`, `8 · Paper-live`, …)  
3. Verdict chip  
4. Title  
5. Learned blurb  
6. Compact **paper $1,000 line** when the brief has a number (end equity and/or vs hold). If there is no single $ figure (year-restart stress, paper-live Day 0), say so plainly — e.g. “$1,000 books open — no P&L yet” or “No single $1,000 path — each year restarts.”

Append new nodes. Do not reorder history.

## Champion strip

The **Champion so far** strip on Progress (and the slim copy on Overview) is the **public-safe story**, not a dump of every brief. Five beats, paper $1,000 only, in this order:

1. `first-grids` / `sma520-stress` → **SMA 5/20 KEEP** (BTC paper baseline)  
2. `sma-sticky-*` → **DROP** sticky for BTC core  
3. `btc-hold-protect*` → **PARK** the hold-protect family  
4. `alts-upside-screen` → **Donchian 10/5 KEEP** (alts)  
5. `paper-live-donchian` → forward paper watch started (**ALGO OUT / ETH IN** on day 0) — **not a new KEEP**

Each beat: date + verdict chip + who + $1,000 figure where known. Extreme compounded backtest dollars (Donchian on ALGO/ETH) must be labelled **paper/historical**, not a live promise.

Update the strip when a KEEP, DROP, or PARK actually changes. Paper-live is a forward clock, not a new KEEP.

Do **not** publish `RISK_PROFILE`, holdings, Revolut, or raw `experiments/results.tsv` on hub pages. Do not invent missing briefs for private-lab run folders.

## Verdict words (use these, not synonyms)

- **Keep** — keep as a *paper baseline or reference*. Never “go live.”
- **Tweak** — idea has a pulse; do not crown it; change the question or the knobs.
- **Drop** — this config or this use is done. Say what was dropped (defaults vs whole family).
- **Parked** — knobs were searched; stop the spiral; keep the write-up. Not a Drop. Use `.chip.park` / "Parked" everywhere — briefs included (copy `--chip-park` tokens from a hub page if the brief lacks them).

When a new brief lands, update:

1. Overview family board + “Right now” paragraph + verdict counts *(hand-written — the story, not the card list)*  
2. Champion strip if the paper leader changed  
3. Progress timeline (append a node; do not reorder history)  
4. Keepers if a champion or reference actually changed  
5. The compact brief list on `index.html` — **this step is CI**

## CI rebuild

`scripts/rebuild_gallery.py` keeps the public site in sync when briefs land.

**Preserve these markers** (the script fails if they are missing):

- `<!-- gallery:briefs:start -->` … `<!-- gallery:briefs:end -->` on Overview  
- `<!-- gallery:updated:start -->` … `<!-- gallery:updated:end -->` on Overview  
- `<!-- gallery:progress-auto:start -->` … `<!-- gallery:progress-auto:end -->` on Progress  
- `<!-- gallery:keepers-auto:start -->` … `<!-- gallery:keepers-auto:end -->` on Keepers  

Do not delete them even when a region is empty.

- **Scans** `docs/briefs/*.html` (title, date, KEEP / TWEAK / DROP / PARKED from hero chips or takeaway chips). Optional override on a brief: `<!-- gallery-card title="…" chip="Keep" class="keep" teaser="$6,196 vs hold $4,619" -->`. The `teaser` is the one-line paper $ (or Day-0) line on Overview cards and auto Progress nodes. Never put an invented dollar figure in `teaser`.  
- **Rewrites** the marked Overview card list and the “Updated …” kicker. Cards show **full date** + chip + title + teaser. Existing card order is kept; new files are appended.  
- **Does not** overwrite the family board, “Right now” copy, champion strip, or verdict counts. Those stay editorial.  
- **Progress / Keepers:** hand-written nodes stay. Briefs not already linked are appended inside the auto markers (keepers only for headline Keep / Parked). Auto Progress nodes also get date + paper line.  
- **Scrub:** fails (or `--strip` redacts) if published hub pages or `briefs/*.{html,md}` contain `RISK_PROFILE`, `0.15 BTC`, Revolut holdings/balances, personal totals like `~$14k` / `$14k` / `~$14,000`, or “core wealth sleeve / accumulate bias”. Hypothetical paper `$1,000` / `$1000` is allowed, as is paper shorthand with a decimal (`~$10.2k`). `UX.md` / `README.md` are not scanned (they name the forbidden words).

Do **not** invent missing briefs for raw `experiments/runs/*` batches — those are already summarized in the published briefs. If a published brief is missing from Progress/Overview, wire it in.

Local:

```bash
python3 scripts/rebuild_gallery.py          # fail on leaks; rebuild hubs
python3 scripts/rebuild_gallery.py --check  # scan only
python3 scripts/rebuild_gallery.py --strip  # redact leaks, then rebuild
```

On push to `main` that touches `docs/briefs/**` or `scripts/**`, `.github/workflows/rebuild-pages.yml` runs the script with `--strip`. If `git diff` is non-empty, `github-actions[bot]` commits and GitHub Pages is asked to rebuild `/docs`. The same workflow runs `--check` on pull requests that touch those paths. `workflow_dispatch` rebuilds like a main push.

Still update the family board / keepers prose / champion strip when the *research story* changes. CI only guarantees every brief has a dated card and is not leaking personal capital.

## Privacy (hard)

Publish **only**:

- Strategy concepts and plain-English rules  
- Paper findings vs **buy & hold**  
- Hypothetical **paper $1,000** (already the brief convention)  
- Keep / Tweak / Drop / Parked  
- Progress over time  

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
- Target ~390px width. Tap targets ≥2.75rem for the theme control.  
- Overview teasers and Progress paper lines must remain readable at ~390px (wrap; do not hide them).  
- Copy tokens from `index.html` when adding a hub page. Do not introduce a bundler.

## Adding a brief

1. Drop the HTML (and optional `.md`) in `docs/briefs/`.  
2. Keep the existing teal/slate brief look.  
3. Add the overview back-link (`../index.html`).  
4. Prefer a `gallery-card` comment with `teaser` pulled from the brief’s own numbers.  
5. CI rebuilds Overview cards and appends missing Progress/Keepers links. Still hand-update the family board / “Right now” / champion strip / keepers prose when the story changes.  
6. Re-read for privacy before merge (or rely on the scrub; do not put holdings in to “see if CI strips them”).

Private research code lives in `offmann/trading-lab`. Patterns only. Never copy holdings, risk profile, or capital targets into this repo.

## What “done” looks like for a visitor

Thirty seconds on Overview: they can say what is ahead, what is dead, **when** the last experiment happened, and that it is paper $1,000. A minute on Progress: they can follow the champion handoff and see how $1,000 moved at each step — then they can ignore the tables.
