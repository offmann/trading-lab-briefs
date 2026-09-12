# Public briefs site — information architecture

GitHub Pages serves `/docs` on `main` → https://offmann.github.io/trading-lab-briefs/

This file is for future agents. The reader of the live site is **not a trader**. Home is the **Investor** digest. They should see **when the site last published** (to the second), what $1,000 would have become vs hold, and then optionally ranks or individual briefs.

**Max 3 tabs.** Do not bring back Overview / Progress / Keepers as top-level nav.

## Pages

| File | Job | Answers |
|------|-----|---------|
| `index.html` | **Investor (home / default)** | Plain English: what was tested that matters, last updated to the second, what it means for an investor, and “$1,000 → $X vs just hold over a clear timeframe.” Lead with the two big numbers when they still hold: **Just hold Bitcoin $19,879** · **ALGO lab pick Donchian 20/12 $18,662**. Optional one-line legend: “Just hold = own the coin. Lab pick = best paper rule we found so far.” |
| `leaderboard.html` | Scoreboard + plot | Ranked paper strategies by sleeve (**BTC / ALGO / ETH**) vs just hold, Lab pick / Still testing / Dropped. Plus a lollipop: each point = an experiment; X = paper end $ from $1,000; Y = ranked strategy. Sleeve filters; do not mix incompatible windows on one series. |
| `experiments.html` | Brief gallery | Dive into individual experiment cards. Revalidation + current lab pick / still testing first. Superseded / invalidated briefs in a collapsed **Superseded** section. |
| `investor.html` | Investor alias | Full duplicate of `index.html` (Investor tab current). Old `/investor.html` bookmarks always show content. |
| `progress.html`, `keepers.html` | Experiments aliases | Full 3-tab Experiments page plus a one-line “this address moved” note, then a short redirect to `experiments.html`. Never a blank stub. Not in primary nav. |
| `briefs/*.html` | Detail | One experiment. Compact top bar: **Back to Investor · Leaderboard · Experiments**. Do not unlist them. Do not resurrect Overview / Progress / Keepers. |

Hub pages use a **three-tab** nav: **Investor / Leaderboard / Experiments**. One row on a phone (~390px). Internal hub links carry `?v=20260912a`. Hub `<head>` includes `Cache-Control: no-cache` and a visible `build 20260912a` footer stamp. Rebuild injects `#gallery-glossary` JSON from `PUBLIC_VERDICT` so the Leaderboard plot reads the same labels.

## Copy rules (hubs)

- Shorten aggressively. Clarity > completeness. No jargon walls.
- **Do not** quote invalidated pre–look-ahead Donchian/SMA KEEP figures on hub pages (no $8.8M / $81.4M / $3.41M / SMA $124k, and no “ignore the million stuff because it was wrong” prose). If a number is wrong, omit it. Individual old briefs in `docs/briefs/` may keep historical pages.
- Privacy: paper **$1,000** only. No holdings, `RISK_PROFILE`, Revolut, or real portfolio $.

## Dates (required)

**Site last-updated** (Investor home, Leaderboard, Experiments kickers) must be **second precision**, like `2026-09-09 13:54:16 CEST` (Europe/Paris) — **not date-only**. Source of truth: the latest git commit that touched `docs/briefs/` (CI rebuild time is the fallback). CI writes this via `<!-- gallery:updated:start -->` … `end`.

Every **Experiments card** must show a clock **to the second**, like `2026-09-06 19:02:20 CEST` — in the card’s date chip **and** in a “Published …” summary line. The same stamp is written on each `docs/briefs/*.html` top meta row. **Never invent seconds** from a date-only filename. Source: `<!-- gallery-published iso source -->` (working tree or last HEAD publish), a full-history git first-add, the [`scripts/brief_timestamps.md`](../scripts/brief_timestamps.md) map, or **first-publish UTC now** only for a filename that is not yet on HEAD. Mapping: [`scripts/brief_timestamps.md`](../scripts/brief_timestamps.md). CI regenerates both surfaces via `format_updated_stamp` / `card_published_label`.

## Truth rails (post harness revalidation)

Verify from published briefs — do not invent dollars:

- **BTC bar = just hold** (~$19,879 from $1,000 on the 9 Sep revalidation full sample; deepest dip ~−76%). Source: `docs/briefs/2026-09-09-harness-revalidation.html`.
- **ALGO lab pick = Donchian 20/12** (~$18,662 vs just hold ~$79). Source: `docs/briefs/2026-09-11-algo-entry-neighborhood.html` (20/12 confirmed; neighborhood brief 10 Sep first moved the pick off 20/10). **Never** hardcode 20/10 as the active ALGO pick on a hub.
- **ETH Donchian 10/5 = still testing** (still beats hold full-sample ~$31.8k vs ~$17.7k, but walk-forward fails — not a lab pick). Source: 9 Sep revalidation.
- Paper-live books that started on old KEEP configs: history; later honest briefs supersede those paper dollars.

## Leaderboard plot

Build from **post-revalidation / honest** paper end equities you can verify in published briefs (revalidation + later ALGO neighborhood confirmation). **Omit** invalidated pre–look-ahead figures. Do **not** fake a multi-day time scatter. ALGO lab pick 20/12 may use its own confirmation clock (`2026-09-11 08:26:08 CEST`); other 9 Sep cells keep `2026-09-09 13:54:16 CEST`. **All** = small multiples (BTC / ALGO / ETH), each with its **own linear $ scale**. Sleeve filter = one larger linear panel. X = paper end $ from $1,000 (lollipop). Y = ranked strategy. Just hold = gray dashed reference. Palette: BTC amber, ALGO teal, ETH indigo. Shapes: Lab pick ● / Still testing ■ / Dropped ○ / Just hold ◆. Label the lab pick and the $ leader. Phone-first ~390px. Inline SVG/JS only.

## Verdict words (public glossary — use these, not KEEP / TWEAK / DROP)

Internal code keys may stay `keep` / `tweak` / `drop` / `park` / `hold` (CSS classes, `Brief.chip_kind`, plot `verdict` fields). **Visitor-facing labels** must come from `PUBLIC_VERDICT` in `scripts/rebuild_gallery.py` at render time. Do not put KEEP / TWEAK / DROP on hub chips, Investor hero labels, or the Leaderboard legend.

| Internal key | Public label | Meaning |
|--------------|--------------|---------|
| `hold` | **Just hold** | Own the coin, no trading rule (baseline). Never call this Keep / Lab pick. |
| `keep` | **Lab pick** | Current paper winner for that sleeve. Never “go live.” |
| `tweak` | **Still testing** | Interesting but not locked. Do not crown it. |
| `drop` | **Dropped** | This config or this use is ruled out. |
| `park` | **Parked** | Knobs were searched; stop the spiral; keep the write-up. Not a Drop. Use `.chip.park`. |

Optional Investor legend (once): “Just hold = own the coin. Lab pick = best paper rule we found so far.”

Rebuild maps experiment cards, leaderboard-auto chips, and brief `<span class="chip …">` KEEP/TWEAK/DROP labels through that glossary. Instruction chips (`Don't`, `Watch`, `Next`) stay as-is. New gallery-card overrides should use `chip="Lab pick"` (class can remain `keep`).

When a new brief lands, update:

1. Investor home if the $1,000 vs hold story changed *(hand-written)*
2. Leaderboard ranks / plot points if sleeve scores or verdicts changed *(hand-written)*
3. Experiments current vs superseded placement if a lab pick / still testing / dropped verdict actually moved
4. The Experiments card lists and the last-updated stamp — **this step is CI**

## CI rebuild

`scripts/rebuild_gallery.py` keeps the public site in sync when briefs land.

**Preserve these markers** (the script fails if they are missing):

- `<!-- gallery:updated:start -->` … `<!-- gallery:updated:end -->` on Investor (`index.html`), Leaderboard, and Experiments (second-precision stamp)
- `<!-- gallery:briefs:start -->` … `<!-- gallery:briefs:end -->` on Experiments (**current** cards)
- `<!-- gallery:superseded:start -->` … `<!-- gallery:superseded:end -->` on Experiments (collapsed archive)
- `<!-- gallery:leaderboard-auto:start -->` … `<!-- gallery:leaderboard-auto:end -->` on Leaderboard (newer research drops after the revalidation day)

Do not delete them even when a region is empty.

- **Scans** `docs/briefs/*.html` (title, date, keep / tweak / drop / park / hold from hero chips or takeaway chips). Optional override on a brief: `<!-- gallery-card title="…" chip="Lab pick" class="keep" teaser="$18,662 vs just hold $79" lane="current" -->`. `lane="superseded"` demotes a new brief. The `teaser` is the one-line paper $ (or Day-0) line on Experiment cards. Never put an invented dollar figure in `teaser`. Public chip text is always the glossary word, even if the brief still says KEEP in the body.
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
- Just hold / Lab pick / Still testing / Dropped / Parked  
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
