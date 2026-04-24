# ATLAS L4 Alpha Discovery Agent - Created

## Task
Created the ATLAS L4 Alpha Discovery agent group for independent alpha discovery.

## Deliverables

### 1. Group Folder
Created: `/workspace/extra/bread-baker/nanoclaw/groups/atlas_l4_alpha_discovery/`

### 2. CLAUDE.md
Created `/workspace/extra/bread-baker/nanoclaw/groups/atlas_l4_alpha_discovery/CLAUDE.md` with:

**Role**: Independent alpha discovery agent — looks for unconventional opportunities that L3 agents might miss

**Philosophy**:
- Scans all sectors for asymmetric risk/reward setups
- Independent from L3 recommendations
- HIGH_CONVICTION, MODERATE_CONVICTION, and EXPLORATORY conviction levels

**Data Sources**:
- Reads L2 sector picks from `/workspace/extra/state/l2/`
- Reads positions from `/workspace/extra/portfolio/positions.json`
- Optionally reads L3 recommendations for context

**Output**: Independent stock recommendations with conviction, written to `/workspace/extra/state/l4/atlas_l4_alpha_discovery.json`

**Startup Checks**:
- L2 signals ready check (verifies L2 files exist and are current)
- Holiday flag check (exits cleanly if holiday-flagged)
- Positions availability check

## Notes
- Follows the same structure as other L4 agents (like atlas_l4_cro)
- Uses atomic writes for JSON output
- Wraps analysis in `<internal>` tags for clean output
- Includes memory management via `/workspace/group/memory.md`
