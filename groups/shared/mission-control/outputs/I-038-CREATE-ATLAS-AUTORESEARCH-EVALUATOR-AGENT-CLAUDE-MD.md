# Task I-038-CREATE-ATLAS-AUTORESEARCH-EVALUATOR-AGENT-CLAUDE-MD

## Summary

Created the ATLAS autoresearch evaluator agent CLAUDE.md file in the nanoclaw groups directory.

## Output

**Location:** `/workspace/extra/bread-baker/nanoclaw/groups/atlas_autoresearch_evaluator/CLAUDE.md`

## Acceptance Criteria Met

- [x] CLAUDE.md created in atlas_autoresearch_evaluator folder
- [x] Evaluation logic compares pre/post change returns (7-day average weighted return comparison)
- [x] Reverts failed changes with git (`git -C /workspace/extra/repo revert --no-edit {commit_sha}`)
- [x] Handles conflicts gracefully (marks as "conflict" status, logs for manual resolution)

## Implementation

The CLAUDE.md implements the evaluation logic from Section 7.8 of IMPLEMENTATION_SPEC.md:

1. Reads pending entries from autoresearch_log.jsonl (status="pending", date <= 7 days ago)
2. Compares agent's 7-day post-commit average return vs 7-day pre-commit average return
3. Also checks if 7-day post-change Sharpe improved by >= 0.05
4. If IMPROVED: marks as "merged"
5. If NOT IMPROVED: reverts via git
6. If git revert fails (conflict): marks as "conflict" for manual resolution
