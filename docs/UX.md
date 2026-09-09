# Public briefs site — information architecture

GitHub Pages serves `/docs` on `main` → https://offmann.github.io/trading-lab-briefs/

This file is for future agents. The reader of the live site is **not a trader**. Lead with status, then offer detail. They should be able to see **when the site last published** (to the second), **when** each experiment happened, and how hypothetical **$1,000** moved — not only Keep / Tweak / Drop chips.

## Pages

| File | Job | Answers |
|------|-----|---------|
| `index.html` | Overview | “What should I care about in under a minute?” KEEP / TWEAK / DROP / PARKED as it stands **now**, plus a slim champion handoff. |
| `progress.html` | Time-series | The primary timeline: date, step, verdict, title, learned blurb, paper $1,000 line. Champion strip lives here. Harness revalidation is the truth-serum beat. |
| `keepers.html` | Survivors | What is still worth remembering, in plain English — and what Keep *does not* mean. |
| `investor.html` | Investor digest | Always: (1) what was tested, (2) what it means, (3) last updated to the second, (4) “if you put $1,000 this way over this timeframe, you’d have ~$X vs hold ~$Y” using **post-revalidation** paper numbers only. |
| `leaderboard.html` | Scoreboard | Ranked paper strategies by sleeve (**BTC / ALGO / ETH**): score vs buy&hold, verdict KEEP/TWEAK/DROP, last run date. Plus chronological **research drops** after the truth serum — progress over time, not only a static champion strip. |
| `briefs/*.html` | Detail | One experiment. Linked from the hub pages. Do not unlist them. |

Do **not** go back to a flat card gallery as the homepage.

## Reader path

1. Overview status + family board  
2. Optional: Progress (time-series), Keepers (why survivors survived), Investor (plain $1,000 digest), or Leaderboard (ranked sleeves)  
3. Optional: a single brief for tables  

Hub pages use a five-tab nav (Overview / Progress / Keepers / Investor / Leaderboard). Wrap to two rows on a phone (~390px). Briefs get a “← Lab overview” link only — no hub tabs on briefs.

## Dates (required)

**Site last-updated** (Overview, Progress, Keepers, Investor, Leaderboard kickers) must be **second precision**, like `2026-09-09 13:54:16 CEST` (Europe/Paris) — **not date-only**. Source of truth: the latest git commit that touched `docs/briefs/` (CI rebuild time is the fallback). CI writes this via `<!-- gallery:updated:start -->` … `end`.

Every **Progress node** and every **Overview brief card** must show the experiment date in full, like `6 Sep 2026` — not `Sep 6`. Include time-of-day **only** if that clock is already written in the brief. Do not invent hours for individual old experiment nodes.

CI uses the same card format (`scripts/rebuild_gallery.py` → `public_date_label`). Filename date (`2026-09-06-…`) is the fallback when the brief body has no date.

## Progress is the time-series surface

`progress.html` is where a non-trader watches **progress over time**. Each hand-written (or auto-appended) node shows, in this order:

1. Date  
2. Step label (`1 · Screen`, `12 · Truth serum`, …)  
3. Verdict chip  
4. Title  
5. Learned blurb  
6. Compact **paper $1,000 line** when the brief has a number (end equity and/or vs hold). If there is no single $ figure (year-restart stress, paper-live Day 0), say so plainly — e.g. “$1,000 books open — no P&L yet” or “No single $1,000 path — each year restarts.”

Append new nodes. Do not reorder history. **Do not delete** paper-live or old KEEP nodes when a later brief supersedes them — append/clarify (“started under old KEEP; revalidation supersedes those paper dollars”).

## Champion strip (post-revalidation)

The **Champion so far** strip on Progress (and the slim copy on Overview) is the **public-safe story**, not a dump of every brief. Paper $1,000 only.

**Current public-safe truth** (from `docs/briefs/2026-09-09-harness-revalidation.html` — verify, do not invent):

- Drop prior Donchian 10/5 KEEPs (BTC/ALGO). Demote old million-dollar figures ($8.8M / $81.4M / SMA $124k etc.) as **look-ahead artefacts**.
- **BTC bar = buy&hold** (~$19,879 from $1,000 on the revalidation full sample; deepest dip ~−76%).
- **Only active KEEP = Donchian 20/10 on ALGO** (~$10,663 vs wrecked ALGO hold ~$79).
- **ETH Donchian 10/5 = TWEAK** (still beats hold full-sample ~$31.8k vs ~$17.7k, but walk-forward fails — not KEEP).
- SMA 5/20 on BTC/ETH: drop vs hold on the honest engine.
- Paper-live books that started on old KEEP configs: history nodes; revalidation supersedes those paper dollars.

The strip may still show the *handoff* (SMA KEEP → sticky DROP → hold-protect PARK → Donchian 10/5 KEEP → paper-live → **9 Sep revalidation**) so a visitor sees how the story changed. The **now** line must not sell the invalidated Donchian 10/5 KEEP or Fast SMA as the Bitcoin bar.

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
5. Investor digest if the $1,000 vs hold story changed  
6. Leaderboard ranks / research-drops if sleeve scores or verdicts changed  
7. The compact brief list on `index.html` and the last-updated stamp — **this step is CI**

## CI rebuild

`scripts/rebuild_gallery.py` keeps the public site in sync when briefs land.

**Preserve these markers** (the script fails if they are missing):

- `<!-- gallery:briefs:start -->` … `<!-- gallery:briefs:end -->` on Overview  
- `<!-- gallery:updated:start -->` … `<!-- gallery:updated:end -->` on Overview, Progress, Keepers, Investor, and Leaderboard (second-precision stamp)  
- `<!-- gallery:progress-auto:start -->` … `<!-- gallery:progress-auto:end -->` on Progress  
- `<!-- gallery:keepers-auto:start -->` … `<!-- gallery:keepers-auto:end -->` on Keepers  
- `<!-- gallery:leaderboard-auto:start -->` … `<!-- gallery:leaderboard-auto:end -->` on Leaderboard (newer research drops)  

Do not delete them even when a region is empty.

- **Scans** `docs/briefs/*.html` (title, date, KEEP / TWEAK / DROP / PARKED from hero chips or takeaway chips). Optional override on a brief: `<!-- gallery-card title="…" chip="Keep" class="keep" teaser="$6,196 vs hold $4,619" -->`. The `teaser` is the one-line paper $ (or Day-0) line on Overview cards and auto Progress nodes. Never put an invented dollar figure in `teaser`.  
- **Rewrites** the marked Overview card list and every `gallery:updated` kicker. Stamp format: `Updated 2026-09-09 13:54:16 CEST · hypothetical $1,000` from the latest `docs/briefs/` commit (override with `GALLERY_UPDATED_AT` or `SOURCE_DATE_EPOCH`). Cards show **full date** + chip + title + teaser. Existing card order is kept; new files are appended.  
- **Does not** overwrite the family board, “Right now” copy, champion strip, investor prose, or leaderboard rank tables. Those stay editorial.  
- **Progress / Keepers / Leaderboard auto:** hand-written nodes stay. Briefs not already linked on the hand-written Progress timeline are appended inside the auto markers (keepers only for headline Keep / Parked). Auto Progress nodes also get date + paper line.  
- **Scrub:** fails (or `--strip` redacts) if published hub pages or `briefs/*.{html,md}` contain `RISK_PROFILE`, `0.15 BTC`, Revolut holdings/balances, personal totals like `~$14k` / `$14k` / `~$14,000`, or “core wealth sleeve / accumulate bias”. Hypothetical paper `$1,000` / `$1000` is allowed, as is paper shorthand with a decimal (`~$10.2k`). `UX.md` / `README.md` are not scanned (they name the forbidden words).

Do **not** invent missing briefs for raw `experiments/runs/*` batches — those are already summarized in the published briefs. If a published brief is missing from Progress/Overview, wire it in.

Local:

```bash
python3 scripts/rebuild_gallery.py          # fail on leaks; rebuild hubs
python3 scripts/rebuild_gallery.py --check  # scan only
python3 scripts/rebuild_gallery.py --strip  # redact leaks, then rebuild
```

On push to `main` that touches `docs/briefs/**` or `scripts/**`, `.github/workflows/rebuild-pages.yml` runs the script with `--strip`. If `git diff` is non-empty, `github-actions[bot]` commits and GitHub Pages is asked to rebuild `/docs`. The same workflow runs `--check` on pull requests that touch those paths. `workflow_dispatch` rebuilds like a main push.

Still update the family board / keepers prose / champion strip / investor digest / leaderboard ranks when the *research story* changes. CI only guarantees every brief has a dated card, the last-updated stamp has seconds, and the site is not leaking personal capital.

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
- Target ~390px width. Tap targets ≥2.75rem for the theme control; hub tabs may wrap (three then two).  
- Overview teasers and Progress paper lines must remain readable at ~390px (wrap; do not hide them).  
- Copy tokens from `index.html` when adding a hub page. Do not introduce a bundler.

## Adding a brief

1. Drop the HTML (and optional `.md`) in `docs/briefs/`.  
2. Keep the existing teal/slate brief look.  
3. Add the overview back-link (`../index.html`).  
4. Prefer a `gallery-card` comment with `teaser` pulled from the brief’s own numbers.  
5. CI rebuilds Overview cards, the second-precision stamp, and appends missing Progress/Keepers/Leaderboard links. Still hand-update the family board / “Right now” / champion strip / keepers / investor / leaderboard ranks when the story changes.  
6. Re-read for privacy before merge (or rely on the scrub; do not put holdings in to “see if CI strips them”).

Private research code lives in `offmann/trading-lab`. Patterns only. Never copy holdings, risk profile, or capital targets into this repo.

## What “done” looks like for a visitor

Thirty seconds on Overview: they can say what is ahead, what is dead, **when the site last published (to the second)**, and that it is paper $1,000. A minute on Progress: they can follow the champion handoff through the 9 Sep truth serum. A minute on Investor: they can answer “if I put $1,000 this way, ~$X vs hold ~$Y.” Leaderboard shows ranked sleeves and later research drops — then they can ignore the tables.
