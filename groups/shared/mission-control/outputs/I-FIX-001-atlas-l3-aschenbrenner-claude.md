# Task I-FIX-001: Create ATLAS L3 Aschenbrenner Agent Group

## Status
**COMPLETED**

## Summary
Created the missing `atlas_l3_aschenbrenner` agent group in the NanoClaw instance at `/workspace/extra/bread-baker/nanoclaw/`.

## Deliverables

### 1. Group Folder
- Path: `/workspace/extra/bread-baker/nanoclaw/groups/atlas_l3_aschenbrenner/`
- Created successfully

### 2. CLAUDE.md
- Path: `/workspace/extra/bread-baker/nanoclaw/groups/atlas_l3_aschenbrenner/CLAUDE.md`
- Role: AI/compute secular thesis investor focusing on the multi-year AI capex supercycle
- Philosophy: Use macro as risk guardrails, not primary drivers. Focus on secular trends in semiconductors, cloud infrastructure, and data center power
- Data Sources:
  - L2 sector picks: `/workspace/extra/bread-baker/nanoclaw/data/state/l2/`
  - Positions: `/workspace/extra/bread-baker/nanoclaw/data/portfolio/positions.json`
  - May read L1 outputs for additional macro context
- Output: Stock recommendations with conviction, written to `/workspace/extra/bread-baker/nanoclaw/data/state/l3/atlas_l3_aschenbrenner.json`
- Includes startup checks for L2 signals ready and holiday flag

## Key Design Decisions

1. **Long-dated conviction thesis**: Aschenbrenner focuses on 3-5+ year AI capex supercycle, not short-term macro trades
2. **Macro as guardrails**: If macro score < -0.5, reduce exposure but preserve core positions - secular thesis overrides
3. **Sector focus**: Primary weight to semiconductors, secondary to data center power and cloud infrastructure
4. **Conviction calibration**: Direct beneficiaries of AI capex get +10-20 conviction boost; severe RISK_OFF (< -0.7) reduces by 10-15

## Related Agents
- L2: `atlas_l2_semiconductor` (primary input)
- Other L3: `atlas_l3_druckenmiller`, `atlas_l3_ackman`, `atlas_l3_baker`
- L4: `atlas_l4_alpha_discovery`, `atlas_l4_cro`, `atlas_l4_autonomous_execution`, `atlas_l4_cio`

## Timestamp
2026-03-15T17:17:00Z