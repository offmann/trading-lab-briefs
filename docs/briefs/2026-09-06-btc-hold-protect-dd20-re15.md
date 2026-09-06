# BTC hold-protect grid winner — stress + walk-forward (dd20 / re15)

**Date:** 2026-09-06 (PT)  
**Paper only.** No Revolut trades.  
**Main SHA (pre-commit):** `5ad3750`  
**Strategy:** `btc_hold_protect` params `{"dd_pct":20,"reentry_pct":15,"fng_floor":0}` · start **$1,000**  
**Grid names:** `configs/grids/btc_hold_protect.yaml` → `dd_pct`, `reentry_pct`  
**Runs:**
- `experiments/runs/stress_20260906T165910Z` (year-split)
- `experiments/runs/walkforward_20260906T165917Z` (rolling WF 365/90/90)
- `experiments/runs/20260906T165938Z/` + `…165939Z/` (full-sample HP 20/15 · SMA 5/20 · B&H)

---

## Verdict: **TWEAK for BTC core · PARK the family**

Grid winner **dd=20 / reentry=15** rescues the idea vs defaults: year-split **5/7** beat B&H (was **1/7**), ending units **0.210 > B&H 0.132**, and walk-forward beat-hold rises to **43%** (was 26%). It still loses badly to **SMA 5/20** on ending units (**0.210 vs 0.612**) and is not an “obvious” core sell rule. **Park further dd/reentry research** on this family for BTC — knobs searched, truth serum done.

---

## Full sample · $ / units / time-in-market

Period **2020-01-01 → 2026-09-05** · $1,000 start.

| Strategy | End $ | Max DD | Trades | Time in mkt | Ending BTC units |
|----------|-------|--------|--------|-------------|------------------|
| **btc_hold_protect** (20/15) | **$16,783** | **−45.6%** | 15 | **54.7%** | **0.210** |
| sma_crossover 5/20 | $48,827 | −40.1% | 70 | 53.8% | **0.612** |
| buy_and_hold | $10,558 | −76.2% | 1 | 100% | 0.132 |

**Read:** Beats hold on **$ and BTC units**; softens DD vs hold (−46% vs −76%). Still ~**2.9×** fewer units than fast SMA. Fewer trades than SMA (15 vs 70) — closer to accumulate style, but not the paper pile winner.

---

## Year-split stress — BTC-USD ($1,000 each year)

| Year | HP 20/15 end $ | PnL | Max DD | Buy&hold end $ | B&H PnL | vs hold |
|------|----------------|-----|--------|----------------|---------|---------|
| 2020 | $4,363 | +336% | −17% | $3,868 | +287% | **BEAT** |
| 2021 | $1,736 | +74% | −32% | $1,563 | +56% | **BEAT** |
| 2022 | $913 | −9% | −19% | $388 | −61% | **BEAT** |
| 2023 | $2,363 | +136% | −19% | $2,469 | +147% | LOST |
| 2024 | $2,317 | +132% | −19% | $2,143 | +114% | **BEAT** |
| 2025 | $1,109 | +11% | −25% | $937 | −6% | **BEAT** |
| 2026* | $901 | −10% | −18% | $914 | −9% | LOST |

\*2026 YTD through data end (~Sep 5).

| Config | Beat B&H | Avg PnL | Worst max DD |
|--------|----------|---------|--------------|
| **HP 20/15** | **5/7** | **+95.8%** | **−32.1%** |
| HP defaults 25/10 | 1/7 | +65.1% | −33.7% |
| Fast SMA 5/20 | **6/7** | +89.9% | −32.5% |

**Read:** Wider re-entry + slightly tighter DD exit flips the year story. Still one shy of SMA’s 6/7; loses 2023 and 2026 YTD to hold.

---

## Walk-forward (fixed params) — BTC-USD

Train 365d / test 90d / step 90d · **23 folds** · $1,000 per fold.

| Metric | HP 20/15 | HP defaults | SMA 5/20 |
|--------|----------|-------------|----------|
| Mean return / fold | **+14.3%** | +12.1% | +11.6% |
| Mean ending equity | **$1,143** | $1,121 | $1,116 |
| Worst max DD | −28.8% | −23.6% | −21.3% |
| Beat buy & hold | **10/23 (43%)** | 6/23 (26%) | **13/23 (57%)** |

**Read:** Best mean return of the three; beat-rate still trails fast SMA. Crash softener with a real OOS lift vs defaults — not the fold champion.

---

## vs buy-and-hold & fast SMA (BTC core)

- vs B&H: **beats** on full-sample $ and units; **5/7** years; softer DD.
- vs SMA 5/20: **loses** on ending units (~2.9× gap) and year/WF beat-rate (5/7 vs 6/7; 43% vs 57%).
- vs defaults: clear **knob win** — family was not dead; defaults were.

---

## Keep / Tweak / Drop

| Item | Call | Why |
|------|------|-----|
| **BTC core rule (20/15)** | **TWEAK** | Beats hold on pile + years; still ≪ SMA units; not “obvious” enough to sell core BTC on this alone |
| **Hold-protect family (BTC)** | **PARK** | dd/reentry grid + stress/WF on winner done — stop knob spiral. Do not DROP the idea (documented soft-hold recipe) |
| Defaults (25/10) as core | **DROP** | Confirmed worse than 20/15 and worse than hold on units |
| Fast SMA 5/20 paper baseline | **KEEP** | Still dominates ending_units |
| Buy&hold core reference | **KEEP** | 100% time-in-market accumulate bar |
| Ship to Revolut | **DROP** | Paper only; no explicit OK |

**Family should be parked** for active BTC research. Optional later branch (not now): one-shot `fng_floor` gate — treat as a new experiment if revisited, not more dd/reentry grids.

---

## Five insights

1. Year-split jumped **1/7 → 5/7** with 20/15 — knobs mattered; defaults were the wrong call, not the family.
2. Ending units **0.210 > B&H 0.132** — first hold-protect config that grows the BTC pile vs hold on the full sample.
3. Still **≪ SMA 5/20 units 0.612** — soft-hold recipe, not the paper alpha winner.
4. WF beat-hold **43%** (vs SMA **57%**, defaults **26%**) — middle ground; mean return actually highest (+14.3%).
5. Time-in-market **54.7%** ≈ SMA; trades **15 vs 70** — calmer than fast SMA, closer to core style.

---

## Next suggestion

**Park hold-protect on BTC.** Point research at a different family (or alts sleeve), or optionally a single Fear & Greed re-entry experiment later. Keep SMA 5/20 as the paper bar to beat on ending_units.

**Harness note:** Params match grid YAML (`dd_pct`, `reentry_pct`). Ledger rows appended in `experiments/results.tsv`.
