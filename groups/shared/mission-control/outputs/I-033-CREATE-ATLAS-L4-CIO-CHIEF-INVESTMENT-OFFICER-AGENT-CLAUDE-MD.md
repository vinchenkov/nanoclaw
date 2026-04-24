# Task I-033: Create ATLAS L4 CIO Agent CLAUDE.md

## Summary
Created (and revised) the CLAUDE.md file for the ATLAS L4 Chief Investment Officer (CIO) agent at:
`/workspace/extra/bread-baker/nanoclaw/agents/atlas_l4_cio/CLAUDE.md`

## Revision Applied (v2)
Addressed all deficiencies from the revision file:

### 1. Decision Rules (Section 7, Phase 2)
- **Rule 1:** New LONG requires ≥2 source agents with weighted avg conviction ≥55
- **Rule 2:** EXIT when any L3 has conviction ≥50 OR CRO EXIT_IMMEDIATELY
- **Rule 3:** Alpha Discovery counts as 1 vote
- **Rule 4:** L3 conflicts net out by weighted conviction, skip if net <30
- **Rule 5:** Skip all SHORT recommendations (deferred to v2)

### 2. Position Sizing Formula
- `darwinian_weight = read from scorecard (default 1.0 if no history)`
- `position_size_pct = min(0.15, 0.05 * darwinian_weight)`
- `shares = floor(portfolio_value * position_size_pct * conviction_weight / current_price)`

### 3. Risk Rules
- Conviction floor by regime: RISK_OFF ≥70, NEUTRAL ≥50, RISK_ON ≥40
- Drawdown protection: If >15% from HWM, reduce gross 50%
- Stop-loss: Position down >20% = EXIT
- Limit price: BUY=quote×1.02, SELL=quote×0.98

### 4. Scorecard Exclusion
Added explicit note: "CIO does NOT log to the scorecard and is excluded from darwinian_weights.json"

## What the CIO Agent Does
- **Synthesizes insights** from all L1-L3 agents (macro regimes, sector regimes, superinvestor recommendations)
- **Makes portfolio allocation decisions** — final buy/sell/hold decisions for capital deployment
- **Coordinates with CRO** — integrates risk oversight and applies risk-adjusted returns framework

## Key Design Decisions

### Portfolio Construction
- Core positions (40-60%): L3 consensus with conviction 70+
- Satellite positions (20-30%): Single-L3 high conviction
- Cash reserve (10-20%): For opportunistic moves

### Risk-Return Framework
- Alpha tier weighting: TIER_1 = 1.0x, TIER_2 = 0.8x, TIER_3 = 0.6x, TIER_4 = 0.4x
- CRO caution multipliers: EXIT_IMMEDIATELY blocks, REDUCED_CONVICTION = 0.7x
- Risk regime integration: Adjusts gross exposure based on CRO assessment

### Coordination with Other L4 Agents
- **From Alpha Discovery:** Receives ranked alpha signals with tier/score, consensus strength
- **From CRO:** Receives risk regime, ticker cautions, override signals
- **Output:** Final portfolio allocation with clear buy/sell/hold actions

## Pattern Followed
Followed the established L4 agent pattern from:
- I-031: CRO (Chief Risk Officer) agent
- I-032: Alpha Discovery agent

All sections match the pattern: Role, Container Paths, Date/Time, Atomic Writes, Philosophy, Data Sources, Analysis Framework, Decision Rules, Position Sizing Formula, Risk Rules, Output Schema, Startup Check, Memory, Output Formatting.