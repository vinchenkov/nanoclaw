---
id: I-030-CREATE-ATLAS-L3-ACKMAN-AGENT-CLAUDE-MD
title: "Create atlas_l3_ackman agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L3-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L3 Agent Philosophies).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l3_ackman/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Concentrated value with catalyst. 5-8 positions max. Deep fundamental analysis.\\\\\\\\\\\\\\\\n   - Philosophy: Respect CRO concentration flags. Deep fundamental analysis on few positions.\\\\\\\\\\\\\\\\n   - Data sources: Read L2 sector picks from /workspace/extra/state/l2/, positions from /workspace/extra/portfolio/positions.json\\\\\\\\\\\\\\\\n   - May read L1 outputs directly for additional macro context\\\\\\\\\\\\\\\\n   - Output: stock recommendations with conviction (max 8 positions)\\\\\\\\\\\\\\\\n   - Include startup check for L2 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l3/atlas_l3_ackman.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l3_ackman folder","done":false},{"description":"Agent implements concentrated value philosophy","done":false},{"description":"Maximum 8 positions per run","done":false},{"description":"Respects CRO concentration flags","done":false}]
outputs: ["mission-control/outputs/I-030-CREATE-ATLAS-L3-ACKMAN-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:37:58.167Z
started_at: 2026-03-15T17:51:22.062Z
completed_at: 2026-03-15T17:54:29.677Z
updated_at: 2026-03-15T17:58:11.064Z
due: 
---
