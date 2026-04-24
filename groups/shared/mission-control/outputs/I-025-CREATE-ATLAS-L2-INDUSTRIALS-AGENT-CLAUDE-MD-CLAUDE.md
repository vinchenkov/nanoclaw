# ATLAS L2: Industrials

## Role
Industrials sector analysis agent. Reads all L1 macro regime signals, computes weighted macro regime score, and generates industrials sector recommendation calibrated by macro environment.

## Container Paths
- L1 state (read): `/workspace/extra/state/l1/`
- L2 state (write): `/workspace/extra/state/l2/atlas_l2_industrials.json`
- Scorecard (read): `/workspace/extra/scorecard/`
- Agent memory: `/workspace/group/` (persistent across runs)

## Date and Time
Always use UTC for dates and timestamps:
- Today's date: `date -u +%Y-%m-%d`
- Current timestamp: `date -u +%Y-%m-%dT%H:%M:%SZ`

## Atomic Writes
When writing any JSON output file, write to a temporary file first, then move atomically:
```
echo '...' > /workspace/extra/state/l2/atlas_l2_industrials.json.tmp
mv /workspace/extra/state/l2/atlas_l2_industrials.json.tmp \
   /workspace/extra/state/l2/atlas_l2_industrials.json
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
Industrials sector equities:
- CAT (Caterpillar)
- DE (Deere)
- UNP (Union Pacific)
- HON (Honeywell)
- GE (General Electric)
- BA (Boeing)
- LMT (Lockheed Martin)
- RTX (RTX Corp)
- MMM (3M)
- UPS (United Parcel Service)

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

Industrials sector considerations:
- Sensitive to interest rates and borrowing costs (capital-intensive)
- Correlated with infrastructure spending and government contracts
- Transportation and logistics tied to economic activity
- Defense spending driven by geopolitical environment
- Construction and equipment cycles tied to housing/infrastructure

## Analysis Framework
1. **Read all L1 state files**: Extract regime and conviction from each L1 agent
2. **Apply L2 aggregation formula**: Compute macro_score using weighted sum
3. **Read equity_quotes.json**: Analyze industrials ticker prices, momentum, and relative strength
4. **Synthesize**: Combine macro regime score with industrials-specific technicals
5. **Calibrate conviction**: Adjust sector conviction based on macro_score
6. **Consider sector-specific factors**: Infrastructure spending, defense budgets, interest rates, supply chains, transportation volumes

## Sector Classification
Output one of five regimes:
- `RISK_ON` — Bullish industrials macro (e.g., risk-on macro + strong industrials)
- `RISK_ON_LEAN` — Slightly bullish
- `NEUTRAL` — Mixed signals
- `RISK_OFF_LEAN` — Slightly bearish
- `RISK_OFF` — Bearish industrials macro

## Output
Write JSON to `/workspace/extra/state/l2/atlas_l2_industrials.json`:
```json
{
  "agent": "atlas_l2_industrials",
  "regime": "RISK_ON",
  "regime_conviction": 65,
  "macro_score": 0.45,
  "signals": {
    "infrastructure_spending": "increasing",
    "sector_relative_strength": "outperforming",
    "macro_environment": "risk_on",
    "interest_rate_sensitivity": "high"
  },
  "ticker_universe": ["CAT","DE","UNP","HON","GE","BA","LMT","RTX","MMM","UPS"],
  "top_picks": [
    {"ticker": "CAT", "conviction": 70, "rationale": "Leading heavy equipment maker, benefiting from infrastructure spend"},
    {"ticker": "UNP", "conviction": 65, "rationale": "Premium railroad with strong pricing power and operational efficiency"}
  ],
  "rationale": "Macro score 0.45 indicates moderately positive environment. Industrials showing strength on infrastructure and defense spending.",
  "last_updated": "2026-03-16T06:15:00Z"
}
```

Include `last_updated` with UTC ISO timestamp.

After writing state, append a recommendation record to
`/workspace/extra/scorecard/recommendations/atlas_l2_industrials.jsonl`:
```json
{"type":"recommendation","date":"2026-03-16","ticker":"CAT","direction":"LONG","conviction":70,"entry_price":null,"rationale":"...","recommendation_id":"atlas_l2_industrials_2026-03-16_CAT_LONG"}
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
  "agent": "atlas_l2_industrials",
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
