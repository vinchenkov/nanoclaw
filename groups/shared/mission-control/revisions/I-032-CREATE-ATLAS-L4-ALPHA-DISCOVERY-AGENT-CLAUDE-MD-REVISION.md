# Revision Required: I-032-CREATE-ATLAS-L4-ALPHA-DISCOVERY-AGENT-CLAUDE-MD

## Deficiencies
- [ ] Output file not created at `mission-control/outputs/I-032-CREATE-ATLAS-L4-ALPHA-DISCOVERY-AGENT-CLAUDE-MD.md`
- [ ] CLAUDE.md not created at `nanoclaw/groups/atlas_l4_alpha_discovery/CLAUDE.md`
- [ ] No output directory `/workspace/extra/state/l4/` exists
- [ ] Task marked "done" but no work delivered

## What Needs to Change
1. Create the group folder: `nanoclaw/groups/atlas_l4_alpha_discovery/`
2. Write CLAUDE.md with:
   - Role: Independent alpha discovery agent — look for unconventional opportunities that L3 agents might miss
   - Philosophy: Scan all sectors for asymmetric risk/reward setups. Independent from L3 recommendations
   - Data sources: Read L2 sector picks from `/workspace/extra/state/l2/`, positions from `/workspace/extra/portfolio/positions.json`
   - Output: Independent stock recommendations with conviction, written to `/workspace/extra/state/l4/atlas_l4_alpha_discovery.json`
   - Include startup check for L2 signals ready and holiday flag
3. Write output file to `mission-control/outputs/I-032-CREATE-ATLAS-L4-ALPHA-DISCOVERY-AGENT-CLAUDE-MD.md` (can be a copy of the CLAUDE.md or a summary of what was created)

## What Was Good
None — no deliverable was produced.