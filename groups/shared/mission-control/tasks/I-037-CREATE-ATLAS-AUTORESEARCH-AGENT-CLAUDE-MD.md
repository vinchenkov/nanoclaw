---
id: I-037-CREATE-ATLAS-AUTORESEARCH-AGENT-CLAUDE-MD
title: "Create atlas_autoresearch agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-PIPELINE-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.7).\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_autoresearch/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Runs at 20:00 every weekday\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 1: Read /workspace/extra/scorecard/agent_scores.json\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 2: Skip agents with status \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"insufficient_data\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\" or returns_count < 20\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 3: Find agent with lowest rolling Sharpe, skip if modified < 7 days ago\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 4: Read agent CLAUDE.md and last 20 recommendations\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 5: Identify ONE failure pattern\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 6: Propose ONE surgical change (1-3 sentences)\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 7: git checkout main (NO branches)\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 8: Apply change to CLAUDE.md\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 9: Commit directly to main\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 10: Record commit SHA\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - STEP 11: Append to /workspace/extra/scorecard/autoresearch_log.jsonl\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - IMPORTANT: Commit directly to main, no branches!\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Wrap all output in <internal> tags"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_autoresearch folder","done":false},{"description":"Minimum data guard implemented","done":false},{"description":"7-day cooldown check implemented","done":false},{"description":"Commits directly to main (no branches)","done":false},{"description":"Logs to autoresearch_log.jsonl","done":false}]
outputs: ["mission-control/outputs/I-037-CREATE-ATLAS-AUTORESEARCH-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:40:15.838Z
started_at: 2026-03-15T19:31:38.262Z
completed_at: 2026-03-15T19:35:15.094Z
updated_at: 2026-03-15T19:37:39.378Z
due: 
---
