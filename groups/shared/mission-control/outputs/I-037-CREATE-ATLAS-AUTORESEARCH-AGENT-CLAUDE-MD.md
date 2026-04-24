# Task I-037-CREATE-ATLAS-AUTORESEARCH-AGENT-CLAUDE-MD

## Summary

Created the `atlas_autoresearch` agent CLAUDE.md based on Section 7.7 of IMPLEMENTATION_SPEC.md.

## Created Files

- **Location:** `/workspace/extra/bread-baker/nanoclaw/groups/atlas_autoresearch/CLAUDE.md`

## Acceptance Criteria Met

| Criteria | Status |
|----------|--------|
| CLAUDE.md created in atlas_autoresearch folder | ✅ |
| Minimum data guard implemented (status "insufficient_data" or returns_count < 20) | ✅ |
| 7-day cooldown check implemented | ✅ |
| Commits directly to main (no branches) | ✅ |
| Logs to autoresearch_log.jsonl | ✅ |

## Agent Workflow

1. Runs at 20:00 every weekday
2. Reads `/workspace/extra/scorecard/agent_scores.json`
3. Filters agents with `status: "insufficient_data"` or `returns_count < 20`
4. Finds agent with lowest rolling Sharpe (skipping those modified by autoresearch < 7 days ago)
5. Reads agent CLAUDE.md and last 20 recommendations
6. Identifies ONE failure pattern
7. Proposes ONE surgical change (1-3 sentences)
8. `git checkout main` (no branches)
9. Applies change to CLAUDE.md
10. Commits directly to main
11. Records commit SHA
12. Appends to `/workspace/extra/scorecard/autoresearch_log.jsonl`

All output wrapped in `<internal>` tags.
