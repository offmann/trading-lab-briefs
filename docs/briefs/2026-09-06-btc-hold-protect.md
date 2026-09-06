# BTC hold-protect — drawdown exit vs B&H & fast SMA

**Date:** 2026-09-06 (PT)  
**Paper only.** No live orders.  
**Main SHA (pre-commit):** `669099c` (strategy + tests + grid YAML already on main)  
**Strategy:** `btc_hold_protect` defaults `{"dd_pct":25,"reentry_pct":10,"fng_floor":0}` · start **$1,000**  
**Runs:**
- `experiments/runs/stress_20260906T165623Z` (year-split)
- `experiments/runs/walkforward_20260906T165620Z` (rolling WF 365/90/90)
- `experiments/runs/20260906T165628Z/` + `…165629Z/` (full-sample hold-protect / SMA 5/20 / B&H)
- `experiments/runs/20260906T165632Z/` (small grid)

---

## Verdict: **TWEAK family · DROP defaults for BTC core**

Hold-protect is the right *shape* for a core sleeve (stay long; exit only on a deep drawdown; re-enter on recovery). With **defaults**, it softens the worst dip (−28% vs B&H −76%) but **shrinks the BTC pile** (ending units **0.077 vs 0.132** hold) and loses calendar years **6/7** to buy&hold. Fast SMA 5/20 still dominates on $ and units. Grid shows **wider re-entry** (15%) helps — family stays alive under RESEARCH “search knobs before killing.”

---

## Full sample · $ / units / time-in-market

Period **2020-01-01 → 2026-09-05** · $1,000 start.

| Strategy | End $ | Max DD | Trades | Time in mkt | Ending BTC units |
|----------|-------|--------|--------|-------------|------------------|
| **btc_hold_protect** (25/10) | **$6,160** | **−28.0%** | 7 | **41.6%** | **0.077** |
| sma_crossover 5/20 | $48,827 | −40.1% | 70 | 53.8% | 0.612 |
| buy_and_hold | $10,558 | −76.2% | 1 | 100% | 0.132 |

**Read:** Defaults buy crash softness by sitting in cash too long after exits — you end with **fewer BTC units than just holding**, which fights the stay-invested style in research rails.

---

## Year-split stress — BTC-USD ($1,000 each year)

| Year | Hold-protect end $ | PnL | Max DD | Buy&hold end $ | B&H PnL | vs hold |
|------|--------------------|-----|--------|----------------|---------|---------|
| 2020 | $3,293 | +229% | −28% | $3,868 | +287% | LOST |
| 2021 | $1,506 | +51% | −24% | $1,563 | +56% | LOST |
| 2022 | $681 | −32% | −34% | $388 | −61% | **BEAT** |
| 2023 | $2,469 | +147% | −20% | $2,469 | +147% | LOST (tie-ish / same path) |
| 2024 | $1,903 | +90% | −26% | $2,143 | +114% | LOST |
| 2025 | $864 | −14% | −24% | $937 | −6% | LOST |
| 2026* | $840 | −16% | −24% | $914 | −9% | LOST |

\*2026 YTD through data end (~Sep 5).

**Summary:** **1/7 years** beat buy & hold · **avg PnL +65.1%** · **worst max drawdown −33.7%** (2022). Soft landing in the crash year; otherwise leave upside on the table.

---

## Walk-forward (fixed params) — BTC-USD

Train 365d / test 90d / step 90d · **23 folds** · $1,000 per fold.

| Metric | Value |
|--------|-------|
| Mean return / fold | **+12.1%** |
| Mean ending equity | **$1,121** |
| Best fold | **+81.5%** |
| Worst fold | **−19.9%** |
| Worst max DD (any fold) | **−23.6%** |
| Beat buy & hold | **6/23 folds (26%)** |

**Read:** Positive mean return, but **rarely beats hold** on short OOS windows. Crash-softener, not an outperformer.

---

## Optional grid (`configs/grids/btc_hold_protect.yaml`)

`dd_pct ∈ {20,25,30}` × `reentry_pct ∈ {5,10,15}` (+ B&H baseline). Ranked by Sharpe:

| Rank | Params | End $ | Max DD | In mkt | Units | vs B&H $ |
|------|--------|-------|--------|--------|-------|----------|
| 1 | dd=20, re=15 | **$16,783** | −46% | 55% | **0.210** | beats |
| 2 | dd=20, re=10 | $10,112 | −26% | 41% | 0.127 | ≈ hold |
| 3 | dd=25, re=15 | $9,428 | −28% | 44% | 0.118 | below |
| 7 (defaults) | dd=25, re=10 | $6,160 | −28% | 42% | 0.077 | below |
| — | buy_and_hold | $10,558 | −76% | 100% | 0.132 | — |

**8/9** hold-protect configs beat B&H on Sharpe. Best config beats hold on **$ and units**, still far behind fast SMA units (0.612). **Wider re-entry** is the useful knob.

---

## vs buy-and-hold & fast SMA (BTC core)

- Defaults: **softer DD**, worse **$**, worse **BTC units**, only **41.6%** time-in-market.
- Calendar years: almost always lose to hold except **2022**.
- Walk-forward: beat hold only **26%** of folds (fast SMA was ~57%).
- Grid winner (20/15): better story vs hold, still not a challenger to SMA 5/20 on units.

---

## Keep / Tweak / Drop

| Item | Call | Why |
|------|------|-----|
| Defaults (25/10) as live BTC core rule | **DROP** | Fewer BTC units than hold; 1/7 year-split wins |
| Hold-protect idea family | **TWEAK** | Right accumulate + crash-exit shape; grid re-entry / F&G next |
| Fast SMA 5/20 paper baseline | **KEEP** | Still dominates $ & units on this path |
| Buy&hold core reference | **KEEP** | 100% time-in-market accumulate bar |
| Go live | **DROP** | Paper only; no explicit OK |

---

## Five insights

1. Defaults cut max DD to **−28%** vs B&H **−76%**, but end equity **$6.2k vs $10.6k** and units **0.077 vs 0.132**.
2. Time-in-market only **41.6%** — cash sits after exits; re-entry at 10% from peak is sticky the wrong way for bulls.
3. Year-split: **only 2022** clearly beats hold; other years leave upside on the table.
4. Walk-forward beat-hold rate **26%** vs prior fast SMA **~57%** — truth serum says defaults are not OOS winners.
5. Small grid: **reentry_pct=15** lifts units above B&H (0.210); still **≪** SMA 5/20 (0.612) — tweak, don’t crown.

---

## Next suggestion (build next)

1. Re-run stress + WF on grid winner **`dd_pct=20, reentry_pct=15`** (and maybe `dd=20, re=10`).
2. Optional: turn on **Fear & Greed re-entry gate** (`fng_floor`) and compare units + beat-B&H rate.
3. Keep scoring **ending_units** + time-in-market alongside $ — BTC core cares about the pile.

**Harness note:** Editable install picked up `btc_hold_protect`; stress / walkforward / backtest / grid CLIs worked. Ledger rows in `experiments/results.tsv`.
