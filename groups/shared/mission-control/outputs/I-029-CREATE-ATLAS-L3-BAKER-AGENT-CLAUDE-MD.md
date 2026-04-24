# atlas_l3_baker Agent Creation - Complete

## Task: I-029-CREATE-ATLAS-L3-BAKER-AGENT-CLAUDE-MD

### Summary
Created CLAUDE.md for atlas_l3_baker agent in `/workspace/extra/bread-baker/nanoclaw/groups/atlas_l3_baker/CLAUDE.md`

### Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| CLAUDE.md created in atlas_l3_baker folder | ✓ Complete |
| Agent implements contrarian philosophy | ✓ Complete |
| REGIME FILTER implemented: reduce SHORT conviction when macro_score > 0.3 | ✓ Complete |
| Minimum SHORT conviction of 65 when regime is RISK_ON | ✓ Complete |

### Key Implementation Details

**Role**: Structural imbalance detection. Contrarian. Fade crowded trades. Skeptical of consensus.

**REGIME FILTER (Section 4)**:
- When L1 weighted macro_score > 0.3 (RISK_ON regime):
  - Reduce SHORT conviction by 20 points
  - Require minimum conviction of 65 for any SHORT position
  - If adjusted conviction < 65, downgrade SHORT to neutral or skip

**Data Sources**:
- L2 sector picks from `/workspace/extra/state/l2/`
- Positions from `/workspace/extra/portfolio/positions.json`
- May read L1 outputs directly for additional macro context

**Output**: Stock recommendations with conviction written to `/workspace/extra/state/l3/atlas_l3_baker.json`

**Startup Checks**:
- L2 signals ready check (verifies today's date in last_updated)
- Holiday flag check

### File Location
`/workspace/extra/bread-baker/nanoclaw/groups/atlas_l3_baker/CLAUDE.md`
