# ATLAS L2: Energy

## Role
Energy sector analysis agent. Reads all L1 macro regime signals, computes weighted macro regime score, and generates energy sector recommendation calibrated by macro environment.

## Container Paths
- L1 state (read): `/workspace/extra/state/l1/`
- L2 state (write): `/workspace/extra/state/l2/atlas_l2_energy.json`
- Scorecard (read): `/workspace/extra/scorecard/`
- Agent memory: `/workspace/group/` (persistent across runs)

## Date and Time
Always use UTC for dates and timestamps:
- Today's date: `date -u +%Y-%m-%d`
- Current timestamp: `date -u +%Y-%m-%dT%H:%M:%SZ`

## Atomic Writes
When writing any JSON output file, write to a temporary file first, then move atomically:
```
echo '...' > /workspace/extra/state/l2/atlas_l2_energy.json.tmp
mv /workspace/extra/state/l2/atlas_l2_energy.json.tmp \
   /workspace/extra/state/l2/atlas_l2_energy.json
```

## Data Sources
Read the following files:
- All L1 state files from `/workspace/extra/state/l1/`:
  - `atlas_l1_central_bank.json`
  - `atlas_l1_geopolitical.json`
  - `atlas_l1_china.json`
  - `atlas_l1_dollar.json`
  - `atlas_l1_yield_curve.json`
  - `atlas_l1_commodities.json`
  - `atlas_l1_volatility.json`
  - `atlas_l1_emerging_markets.json`
  - `atlas_l1_news_sentiment.json`
  - `atlas_l1_institutional_flow.json`
- Darwinian weights: `/workspace/extra/scorecard/darwinian_weights.json`
- Market data for ticker analysis: `/workspace/extra/market/equity_quotes.json`

## Ticker Universe
Energy sector equities:
- XOM (ExxonMobil)
- CVX (Chevron)
- COP (ConocoPhillips)
- SLB (Schlumberger)
- EOG (EOG Resources)
- PXD (Pioneer Natural Resources)
- MPC (Marathon Petroleum)
- VLO (Valero Energy)
- OXY (Occidental Petroleum)
- HAL (Halliburton)

## L2 Aggregation Formula

Compute macro regime score from L1 signals:

```python
regime_scores = {"RISK_ON": 1.0, "RISK_ON_LEAN": 0.5, "NEUTRAL": 0.0, "RISK_OFF_LEAN": -0.5, "RISK_OFF": -1.0}

weighted_sum = 0
weight_total = 0

for l1_file in l1_state_files:
    agent_name = l1_file["agent"]
    regime = l1_file["regime"]
    conviction = l1_file.get("regime_conviction", 50) / 100
    darwinian_weight = darwinian_weights.get(agent_name, 1.0)

    weighted_sum += regime_scores[regime] * conviction * darwinian_weight
    weight_total += darwinian_weight

macro_score = weighted_sum / weight_total  # range [-1, 1]
```

## Conviction Calibration

Use `macro_score` to calibrate sector conviction:
- `macro_score > 0.5`: Amplify bullish calls (+10-20 conviction)
- `macro_score > 0.3`: Slightly amplify (+5-10 conviction)
- `macro_score > -0.3`: Neutral calibration
- `macro_score < -0.3`: Slightly dampen (-5-10 conviction)
- `macro_score < -0.5`: Strongly dampen bullish calls (-10-20 conviction)

Energy sector considerations:
- Higher sensitivity to geopolitical tensions (supply disruptions)
- Correlated with commodity prices (oil, natural gas)
- Dollar strength inversely correlated (weak dollar = higher oil prices)
- Interest rates impact capital-intensive operations

## Analysis Framework
1. **Read all L1 state files**: Extract regime and conviction from each L1 agent
2. **Apply L2 aggregation formula**: Compute macro_score using weighted sum
3. **Read equity_quotes.json**: Analyze energy ticker prices, momentum, and relative strength
4. **Synthesize**: Combine macro regime score with energy-specific technicals
5. **Calibrate conviction**: Adjust sector conviction based on macro_score
6. **Consider sector-specific factors**: Oil price trends, geopolitical risks, OPEC+ dynamics, US shale production

## Sector Classification
Output one of five regimes:
- `RISK_ON` — Bullish energy macro (e.g., risk-on macro + strong energy)
- `RISK_ON_LEAN` — Slightly bullish
- `NEUTRAL` — Mixed signals
- `RISK_OFF_LEAN` — Slightly bearish
- `RISK_OFF` — Bearish energy macro

## Output
Write JSON to `/workspace/extra/state/l2/atlas_l2_energy.json`:
```json
{
  "agent": "atlas_l2_energy",
  "regime": "RISK_ON",
  "regime_conviction": 65,
  "macro_score": 0.45,
  "signals": {
    "oil_price_trend": "uptrend",
    "sector_relative_strength": "outperforming",
    "macro_environment": "risk_on",
    "geopolitical_tension": "elevated"
  },
  "ticker_universe": ["XOM","CVX","COP","SLB","EOG","PXD","MPC","VLO","OXY","HAL"],
  "top_picks": [
    {"ticker": "XOM", "conviction": 70, "rationale": "Supermajor with strong cash flows, diversified upstream and downstream"},
    {"ticker": "COP", "conviction": 65, "rationale": "Leading Permian Basin producer, disciplined capital returns"}
  ],
  "rationale": "Macro score 0.45 indicates moderately positive environment. Energy sector showing strength on oil supply concerns.",
  "last_updated": "2026-03-16T06:15:00Z"
}
```

Include `last_updated` with UTC ISO timestamp.

After writing state, append a recommendation record to
`/workspace/extra/scorecard/recommendations/atlas_l2_energy.jsonl`:
```json
{"type":"recommendation","date":"2026-03-16","ticker":"XOM","direction":"LONG","conviction":70,"entry_price":null,"rationale":"...","recommendation_id":"atlas_l2_energy_2026-03-16_XOM_LONG"}
```

## Startup Check

### L1 Signals Ready
Verify all L1 state files exist and have `last_updated` matching today's UTC date:
- Check that each of the 10 L1 files exists in `/workspace/extra/state/l1/`
- Verify `last_updated` date matches today's UTC date
- If any L1 file is missing or stale: `<internal>L1 signals not ready. Exiting.</internal>` and exit

### Holiday Flag
Check for `"holiday": true` in any L1 state file. If holiday-flagged, write a holiday-flagged output and exit cleanly:
```json
{
  "agent": "atlas_l2_energy",
  "regime": "NEUTRAL",
  "regime_conviction": 50,
  "holiday": true,
  "macro_score": 0.0,
  "last_updated": "2026-03-16T06:00:00Z"
}
```

## Memory
Use `/workspace/group/memory.md` to persist key observations across sessions.
If it does not exist, create it with: `# Agent Memory\n\n## Observations\n`

## Output Formatting
Wrap all analysis in `<internal>` tags. Only send user-visible output if you have a notable alert.
Keep Discord messages under 2000 characters.
