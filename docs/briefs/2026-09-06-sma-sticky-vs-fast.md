# Sticky SMA vs Fast SMA 5/20 — BTC core sleeve

**Date:** 2026-09-06 (PT)  
**Paper only.** No Revolut trades.  
**Main SHA:** `10bb811` (PR #4 merged — `sma_sticky` + `time_in_market` / `ending_units`)  
**Cash:** $1,000 start · fees 10 bps + slippage 5 bps  
**Runs:**
- `experiments/runs/stress_20260906T163824Z` — sticky year-split
- `experiments/runs/stress_20260906T163829Z` — fast SMA year-split (refresh)
- `experiments/runs/walkforward_20260906T163830Z` — sticky WF 365/90/90
- `experiments/runs/walkforward_20260906T163837Z` — fast SMA WF refresh
- `experiments/runs/20260906T163836Z/` — full-sample sticky / fast / buy&hold

**Diagrams:** `briefs/sma-sticky-vs-fast-top.png` · `briefs/sma-sticky-vs-fast-mid.png`

---

## Verdict: **TWEAK** the sticky *family* · **DROP** these sticky defaults as a BTC core rule

Sticky defaults (20/50, confirm=2, exit_gap=1%) were meant to stay invested more and grow BTC units. On this sample they **do not beat** the fast SMA 5/20 baseline on $, units, year-split, or walk-forward — and they only **roughly match buy&hold dollars** while being out of the market ~44% of the time. Keep the idea alive for a **grid search** (per RESEARCH: don’t kill the family until knobs are searched). Do **not** treat default sticky as a live core replacement for holding or for the existing fast-SMA paper baseline.

---

## Full-sample backtest (2020-01-01 → 2026-09-05)

| Strategy | End $ | PnL | Max DD | Trades | Time in mkt | Ending BTC units |
|----------|-------|-----|--------|--------|-------------|------------------|
| **sma_sticky** 20/50 c2 g1% | $10,169 | +917% | −52.2% | 24 | **56.3%** | **0.127** |
| **sma_crossover** 5/20 | **$48,827** | **+4,783%** | −40.1% | 70 | 53.8% | **0.612** |
| **buy_and_hold** | $10,558 | +956% | −76.2% | 1 | 100% | 0.132 |

**Read:** Sticky ≈ buy&hold on dollars and BTC-units, with a softer worst dip (−52% vs −76%) but **half the time flat**. Fast SMA prints far more $ and ~4.6× the ending BTC units — at the cost of more trades and still only ~54% time invested. Sticky’s slightly higher time-in-market vs fast does **not** translate into more BTC accumulated with these defaults (laggy entries miss early bull legs).

---

## Year-split stress — BTC-USD ($1,000 each calendar year)

### Sticky defaults

| Year | Sticky end $ | PnL | Max DD | B&H end $ | B&H PnL | vs hold |
|------|--------------|-----|--------|-----------|---------|---------|
| 2020 | $2,678 | +168% | −17% | $3,868 | +287% | LOST |
| 2021 | $1,092 | +9% | −22% | $1,563 | +56% | LOST |
| 2022 | $607 | −39% | −47% | $388 | −61% | **BEAT** |
| 2023 | $1,165 | +17% | −26% | $2,469 | +147% | LOST |
| 2024 | $1,343 | +34% | −37% | $2,143 | +114% | LOST |
| 2025 | $1,153 | +15% | −14% | $937 | −6% | **BEAT** |
| 2026* | $1,255 | +26% | −14% | $914 | −9% | **BEAT** |

\*2026 YTD through data end (~Sep 5).

**Sticky summary:** **3/7** beat buy&hold · avg PnL **+32.8%** · worst max DD **−46.7%** (2022).

### Fast SMA 5/20 (refresh — unchanged story)

| Year | Fast end $ | PnL | Max DD | vs hold |
|------|------------|-----|--------|---------|
| 2020 | $4,258 | +326% | −17% | **BEAT** |
| 2021 | $1,661 | +66% | −32% | **BEAT** |
| 2022 | $727 | −27% | −33% | **BEAT** |
| 2023 | $1,714 | +71% | −18% | LOST |
| 2024 | $2,545 | +154% | −13% | **BEAT** |
| 2025 | $1,107 | +11% | −16% | **BEAT** |
| 2026* | $1,280 | +28% | −9% | **BEAT** |

**Fast summary:** **6/7** beat · avg **+89.9%** · worst DD **−32.5%**.

**Plain English:** Sticky softens 2022 a bit vs sitting through the crash, and wins 2025/2026 YTD — but it **gives up huge bull years** (2020, 2023, 2024) vs both hold and the fast rule. Fast remains the stronger year-split paper baseline.

---

## Walk-forward (fixed params) — train 365 / test 90 / step 90 · 23 folds

| Metric | Sticky 20/50 | Fast 5/20 |
|--------|--------------|-----------|
| Mean return / fold | **+2.1%** | **+11.6%** |
| Mean ending equity | $1,021 | $1,116 |
| Best / worst fold | +45.0% / −16.2% | +56.6% / −13.0% |
| Worst max DD | −21.7% | −21.3% |
| Beat buy & hold | **12/23 (52%)** | **13/23 (57%)** |

Sticky’s rolling edge is **thin** — barely coin-flip vs hold, and clearly behind fast SMA.

---

## Keep / Tweak / Drop (BTC core sleeve)

| Item | Call | Why |
|------|------|-----|
| Sticky **defaults** as live / core rule | **DROP** | Loses to fast SMA on $ & units; ≈B&H $ while out ~44% of bars |
| Sticky **idea family** (confirm + exit gap) | **TWEAK** | Grid search before killing family (RESEARCH rule) |
| Fast SMA 5/20 paper baseline | **KEEP** (research) / **TWEAK** (live core) | Still best of the three on paper $; sells too often for accumulate bias |
| Buy & hold BTC | **KEEP** as core reference | 100% time-in-market; deepest DD |
| Ship any of these to Revolut now | **DROP** | Paper only; no explicit OK |

---

## Five insights

1. **Sticky ≠ more BTC here.** Time-in-market 56% vs fast 54%, but ending units **0.127 vs 0.612** — confirmation lag costs early trend capture.
2. **Dollar lens:** full-sample sticky ~$10.2k ≈ buy&hold ~$10.6k; fast ~$48.8k dominates on this path.
3. **Truth serum:** sticky year-split only **3/7** beat hold (fast **6/7**); WF mean **+2%** vs fast **+12%**.
4. **Crash softness alone isn’t enough** for the core sleeve if you miss most of the bull (2020/2023/2024).
5. **Next:** run `configs/grids/sma_sticky.yaml` (and maybe shorter fast windows with sticky exits) — score **ending_units** and time-in-market, not just Sharpe.

---

## Next suggestion

1. Grid-search sticky params; rank by **ending_units** + beat-B&H rate, not only return.  
2. Optional hybrid: fast entry / sticky exit (or shorter 10/30 with gap).  
3. Keep fast SMA 5/20 as the paper champion to beat until a sticky config clearly wins units **and** softens dips.

**Harness note:** PR #4 metrics (`time_in_market`, `ending_units`) printed correctly on single backtests. Ledger rows appended in `experiments/results.tsv`.
