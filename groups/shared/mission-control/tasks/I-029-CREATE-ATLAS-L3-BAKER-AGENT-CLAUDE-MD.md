---
id: I-029-CREATE-ATLAS-L3-BAKER-AGENT-CLAUDE-MD
title: "Create atlas_l3_baker agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L3-AGENTS
description: "For Bread Baker changes, DO NOT use a separate worktree or git branch. Work on the git repo as it is.\\\\\\\\n\\\\\\\\n1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L3 Agent Philosophies).\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l3_baker/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Role: Structural imbalance detection. Contrarian. Fade crowded trades. Skeptical of consensus.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Philosophy: REGIME FILTER - When L1 weighted macro_score > 0.3, reduce SHORT conviction by 20 points and require minimum conviction 65 for any SHORT position.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Data sources: Read L2 sector picks from /workspace/extra/state/l2/, positions from /workspace/extra/portfolio/positions.json\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - May read L1 outputs directly for additional macro context\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Output: stock recommendations with conviction\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Include startup check for L2 signals ready and holiday flag\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l3/atlas_l3_baker.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l3_baker folder","done":false},{"description":"Agent implements contrarian philosophy","done":false},{"description":"REGIME FILTER implemented: reduce SHORT conviction when macro_score > 0.3","done":false},{"description":"Minimum SHORT conviction of 65 when regime is RISK_ON","done":false}]
outputs: ["mission-control/outputs/I-029-CREATE-ATLAS-L3-BAKER-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason:
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:37:49.817Z
started_at: 2026-03-15T15:56:42.332Z
completed_at: 2026-03-15T20:20:56.121Z
updated_at: 2026-03-15T20:21:40.400Z
due: 
---
