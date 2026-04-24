---
id: I-023-CREATE-ATLAS-L2-CONSUMER-AGENT-CLAUDE-MD
title: "Create atlas_l2_consumer agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L2-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L2 Aggregation Formula).\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l2_consumer/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Role: Consumer sector analysis\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Data sources: Read all 10 L1 state files from /workspace/extra/state/l1/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Compute macro regime score using weighted L1 signals\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Ticker universe: AMZN, TSLA, HD, NKE, SBUX, MCD, TGT, COST, WMT, PG\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Output: sector recommendation with conviction calibrated by macro_score\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Include startup check for L1 signals ready and holiday flag\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l2/atlas_l2_consumer.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l2_consumer folder","done":false},{"description":"Agent reads all 10 L1 state files","done":false},{"description":"Ticker universe includes 10 consumer stocks","done":false}]
outputs: ["mission-control/outputs/I-023-CREATE-ATLAS-L2-CONSUMER-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:36:22.660Z
started_at: 2026-03-15T15:00:00.232Z
completed_at: 2026-03-15T15:02:49.166Z
updated_at: 2026-03-15T15:05:18.446Z
due: 
---
