# Experiment card timestamps

Every Experiments card (and each brief’s top meta row) shows a clock
**to the second** in Europe/Paris: `YYYY-MM-DD HH:MM:SS CEST` (or `CET`).

`scripts/rebuild_gallery.py` **never invents seconds** from a filename date.
Resolution order:

1. `<!-- gallery-published iso="…" source="…" -->` already in the brief HTML
2. Git **committer** date of the first add of that file
   (`git log --diff-filter=A`, **no** `--follow` — `--follow` invented Sep 6
   first-adds for later briefs via rename/copy detection)
3. **First-publish** (untracked / no git first-add yet): timezone-aware UTC
   `now` truncated to seconds, `source="first-publish"` (plus
   `trading-lab@<sha>` when `TRADING_LAB_SHA`, `GALLERY_COMMIT_MESSAGE`, or a
   `trading-lab` GitHub Actions `GITHUB_SHA` is in the environment). The
   rebuild embeds the comment so later runs reuse it. This is the CI path:
   private `publish-briefs.yml` copies briefs, runs this script, *then*
   commits — so new files have no first-add history at rebuild time.

`iso` is stored in UTC (or with an offset). Display is converted with
`ZoneInfo("Europe/Paris")`. Freeze first-publish with `GALLERY_PUBLISHED_AT`.

The private `offmann/trading-lab` tree is not cloned here. When a publish
commit message includes `trading-lab@<sha>`, that sha is recorded in
`source` so the clock can be traced back to the lab snapshot.

## First-add map (this repo, as of 2026-09-09)

| Brief | UTC add (`%cI`) | Display (CEST) | Source |
|-------|-----------------|----------------|--------|
| `2026-09-06-first-grids.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` (initial gallery) |
| `2026-09-06-sma520-stress.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` |
| `2026-09-06-sma-sticky-grid.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` |
| `2026-09-06-sma-sticky-vs-fast.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` |
| `2026-09-06-btc-hold-protect.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` |
| `2026-09-06-btc-hold-protect-dd20-re15.html` | 2026-09-06T17:02:20+00:00 | 2026-09-06 19:02:20 CEST | git-add `502d31b` |
| `2026-09-06-alts-upside-screen.html` | 2026-09-06T19:08:29+00:00 | 2026-09-06 21:08:29 CEST | git-add `f23ce05` trading-lab@bdd90fab |
| `2026-09-07-paper-live-donchian.html` | 2026-09-07T06:34:52+00:00 | 2026-09-07 08:34:52 CEST | git-add `7b60c89` trading-lab@70a7a0a0 |
| `2026-09-08-btc-donchian-transfer.html` | 2026-09-09T06:36:06+00:00 | 2026-09-09 08:36:06 CEST | git-add `6cfc28d` trading-lab@348e3b48 |
| `2026-09-09-btc-donchian-hold.html` | 2026-09-09T06:36:06+00:00 | 2026-09-09 08:36:06 CEST | git-add `6cfc28d` trading-lab@348e3b48 |
| `2026-09-09-paper-live-btc-donchian.html` | 2026-09-09T06:36:06+00:00 | 2026-09-09 08:36:06 CEST | git-add `6cfc28d` trading-lab@348e3b48 |
| `2026-09-09-harness-revalidation.html` | 2026-09-09T11:54:16+00:00 | 2026-09-09 13:54:16 CEST | git-add `c07e6ba` trading-lab@4c524ad5 |

The 8 Sep transfer brief is dated 8 Sep in the filename and body, but it
**first landed in this public repo** on the 9 Sep 08:36:06 CEST publish.
The card clock follows the repo add, not a made-up 8 Sep midnight.

Later scrubs that rewrite HTML do not move the clock — the first-add
comment is written into the brief and reused.

Site-wide “Updated …” kickers on Investor / Leaderboard / Experiments
still use the latest commit that touched `docs/briefs/` (not per-card).
