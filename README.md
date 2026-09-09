# trading-lab-briefs

Public GitHub Pages site for paper-only experiment findings from trading-lab.

- Live: https://offmann.github.io/trading-lab-briefs/
- Source: `/docs` on `main`
- IA for agents: [`docs/UX.md`](docs/UX.md)

**Investor** (home) → **Leaderboard** → **Experiments**, then individual briefs on demand. Hypothetical paper $1,000 only — no holdings, balances, or personal risk-profile text.

## CI

Briefs become public pages like this:

1. Drop `docs/briefs/<date>-<slug>.html` (optional `.md`) on `main`.
2. GitHub Action [rebuild-pages](.github/workflows/rebuild-pages.yml) runs `scripts/rebuild_gallery.py --strip` on that push (or via **Actions → Rebuild Pages → Run workflow**).
3. The script rebuilds Experiments cards from the briefs, stamps last-updated to the second (Europe/Paris) on Investor / Leaderboard / Experiments, appends missing post-revalidation Leaderboard drops, and redacts forbidden personal-capital patterns.
4. If the hub HTML changed, `github-actions[bot]` commits; GitHub Pages then serves the updated `/docs` tree.

Hand-edit Investor copy / leaderboard ranks and plot when the research story changes — see [`docs/UX.md`](docs/UX.md).
