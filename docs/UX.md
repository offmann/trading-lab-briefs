# Public briefs site — information architecture

GitHub Pages serves `/docs` on `main` → https://offmann.github.io/trading-lab-briefs/

This file is for future agents. The reader of the live site is **not a trader**. Lead with status, then offer detail.

## Pages

| File | Job | Answers |
|------|-----|---------|
| `index.html` | Overview | “What should I care about in under a minute?” KEEP / TWEAK / DROP / PARKED as it stands **now**. |
| `progress.html` | Timeline | How the six experiments unfolded and what each taught. |
| `keepers.html` | Survivors | What is still worth remembering, in plain English — and what Keep *does not* mean. |
| `briefs/*.html` | Detail | One experiment. Linked from the three hub pages. Do not unlist them. |

Do **not** go back to a flat card gallery as the homepage.

## Reader path

1. Overview status + family board  
2. Optional: Progress (learning arc) or Keepers (why survivors survived)  
3. Optional: a single brief for tables  

Hub pages use a three-tab nav (Overview / Progress / Keepers). Briefs get a “← Lab overview” link only.

## Verdict words (use these, not synonyms)

- **Keep** — keep as a *paper baseline or reference*. Never “go live.”
- **Tweak** — idea has a pulse; do not crown it; change the question or the knobs.
- **Drop** — this config or this use is done. Say what was dropped (defaults vs whole family).
- **Parked** — knobs were searched; stop the spiral; keep the write-up. Not a Drop. Use `.chip.park` / "Parked" everywhere — briefs included (copy `--chip-park` tokens from a hub page if the brief lacks them).

When a new brief lands, update:

1. Overview family board + “Right now” paragraph + verdict counts  
2. Progress timeline (append a node; do not reorder history)  
3. Keepers if a champion or reference actually changed  
4. The compact brief list on `index.html`

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
- Copy tokens from `index.html` when adding a hub page. Do not introduce a bundler.

## Adding a brief

1. Drop the HTML (and optional `.md`) in `docs/briefs/`.  
2. Keep the existing teal/slate brief look.  
3. Add the overview back-link (`../index.html`).  
4. Update the three hub pages as above.  
5. Re-read for privacy before merge.

Private research code lives in `offmann/trading-lab`. Patterns only. Never copy holdings, risk profile, or capital targets into this repo.

## What “done” looks like for a visitor

Thirty seconds on Overview: they can say what is ahead, what is dead, and that it is paper $1,000 — then they can ignore the tables.
