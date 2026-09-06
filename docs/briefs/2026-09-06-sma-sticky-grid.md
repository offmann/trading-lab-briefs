# Sticky SMA grid — BTC core (full sample)

**Date:** 2026-09-06 (PT)  
**Paper only.** No live orders. No merge.  
**Main SHA:** `10bb811`  
**Cash:** $1,000 · fees 10 bps + slippage 5 bps  
**Grid:** `configs/grids/sma_sticky.yaml` → 81 sticky cells (+ B&H)  
**Primary run folder:** `experiments/runs/20260906T164117Z/` (2020-01-01 → 2026-09-05)

---

## Verdict: **TWEAK → DROP** for BTC *core* trading · knobs helped, family still not a core rule

Grid search **did** find sticky configs that clearly beat **defaults** on ending BTC units and that **soften** year-split drawdowns vs defaults. None beat **fast SMA 5/20** on ending_units. Year-split beat-rate vs buy&hold stays **3/7** (same as defaults; fast is **6/7**). Soft DD is not enough for a BTC accumulation sleeve that keeps missing bull years.

**Next research (pick one):**
1. **BTC rule that only exits on deep drawdown / Fear&Greed** (stay long otherwise — hold-friendly core).
2. **Try sticky / slower trend on an alts sleeve** (not core BTC), where softer dips matter more than max units.

---

## Top 5 sticky — by ending_units (= by total return on this grid)

| # | Params | End $ | Return | Max DD | Time in mkt | Ending units | Trades |
|---|--------|-------|--------|--------|-------------|--------------|--------|
| 1 | **10/100 c1 g0.5** | **$17,520** | **+1,652%** | **−31.9%** | 55.5% | **0.219** | 14 |
| 2 | 20/50 c1 g2.0 | $16,004 | +1,500% | −43.3% | 60.6% | 0.200 | 21 |
| 3 | 10/100 c1 g1.0 | $15,913 | +1,491% | −39.2% | 55.8% | 0.199 | 14 |
| 4 | 10/100 c1 g2.0 | $15,856 | +1,486% | −38.0% | 57.3% | 0.199 | 12 |
| 5 | 20/50 c3 g2.0 | $15,584 | +1,458% | −44.9% | 58.9% | 0.195 | 21 |

Defaults (20/50 c2 g1.0): **$10,169** · units **0.127** · DD −52.2% · 56.3% in market.  
**28/81** sticky configs beat defaults on ending_units. Best sticky units **0.219 > B&H 0.132**.

---

## Focused comparison — full sample

| Strategy | End $ | Return | Max DD | Time in mkt | Ending units |
|----------|-------|--------|--------|-------------|--------------|
| Sticky **10/100 c1 g0.5** (grid best) | $17,520 | +1,652% | −31.9% | 55.5% | **0.219** |
| Sticky 20/50 c1 g2.0 | $16,004 | +1,500% | −43.3% | 60.6% | 0.200 |
| Sticky **defaults** 20/50 c2 g1.0 | $10,169 | +917% | −52.2% | 56.3% | 0.127 |
| **sma_crossover 5/20** | **$48,827** | **+4,783%** | −40.1% | 53.8% | **0.612** |
| buy_and_hold | $10,558 | +956% | −76.2% | 100% | 0.132 |

**Beat fast 5/20 on ending_units?** **No** — best sticky 0.219 vs fast **0.612** (~2.8× gap).

---

## Year-split stress ($1k fresh each calendar year)

| Config | Beat B&H | Avg PnL | Worst max DD |
|--------|----------|---------|--------------|
| Sticky **10/100 c1 g0.5** | **3/7** | +33.6% | **−26.4%** |
| Sticky 20/50 c1 g2.0 | 3/7 | +39.6% | −43.3% |
| Sticky defaults | 3/7 | +32.8% | −46.7% |
| Fast SMA 5/20 | **6/7** | **+89.9%** | −32.5% |

Grid best **softens** vs defaults (worst DD −26% vs −47%, and 2022 only −7% vs −39%) but **does not raise** the beat-rate vs hold. Still loses 2020/2021/2023/2024 vs B&H.

---

## Paths

| What | Path |
|------|------|
| Full-sample grid (ranked) | `experiments/runs/20260906T164117Z/` |
| Default-start grid (2023+, superseded) | `experiments/runs/20260906T164055Z/` |
| Focused full-sample cmp | `experiments/runs/20260906T164157Z/` · `…164158Z/` · `…164159Z/` |
| Stress top sticky | `experiments/runs/stress_20260906T164206Z/` |
| Stress defaults + #2 | `experiments/runs/stress_20260906T164207Z/` |
| Stress fast 5/20 + sticky g1 | `experiments/runs/stress_20260906T164208Z/` |
| Ledger | `experiments/results.tsv` |
| This brief | `briefs/2026-09-06-sma-sticky-grid.md` · `.html` |
