# Revision Required: I-033-CREATE-ATLAS-L4-CIO-CHIEF-INVESTMENT-OFFICER-AGENT-CLAUDE-MD

## Deficiencies
- [ ] Output file name incorrect: CLAUDE.md writes to `atlas_l4_cio.json` but MUST write to `portfolio_actions.json` per spec Section 3.7. The downstream pipeline (atlas_l4_autonomous_execution) reads from `portfolio_actions.json` - this agent's output is currently unusable by the execution layer.

## What Needs to Change
The CLAUDE.md currently writes to `/workspace/extra/state/l4/atlas_l4_cio.json`. Change this to write to `/workspace/extra/state/l4/portfolio_actions.json` with the schema defined in spec Section 3.7:

```json
{
  "market_view": "string",
  "regime_summary": "aggregated L1 signal with weights",
  "actions": [
    {
      "ticker": "XOM",
      "action": "SELL",
      "intent": "close_long",
      "side": "sell",
      "shares": 120,
      "limit_price": 113.20,
      "rationale": "...",
      "conviction": 74
    }
  ],
  "portfolio_exposure": {"gross": 0.81, "net": 0.81, "cash_pct": 0.19},
  "risk_commentary": "...",
  "last_updated": "2026-03-16T10:20:00Z"
}
```

Key fields:
- `action`: BUY | SELL | HOLD
- `intent`: open_long | close_long (v1 long-only)
- `side`: buy | sell (Alpaca API)
- `limit_price`: BUY = quote × 1.02, SELL = quote × 0.98
- `portfolio_exposure`: projected AFTER actions execute

The existing `atlas_l4_cio.json` output can remain as internal state, but the critical execution output MUST be `portfolio_actions.json`.

## What Was Good
- All 5 decision rules now implemented correctly
- Position sizing formula matches spec exactly
- Risk rules fully implemented (drawdown, stop-loss, conviction floors, limits)
- Darwinian exclusion properly documented
- Agent folder structure and CLAUDE.md format are correct
