---
id: I-025-CREATE-ATLAS-L2-INDUSTRIALS-AGENT-CLAUDE-MD
title: "Create atlas_l2_industrials agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L2-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L2 Aggregation Formula).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l2_industrials/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Industrials sector analysis\\\\\\\\\\\\\\\\n   - Data sources: Read all 10 L1 state files from /workspace/extra/state/l1/\\\\\\\\\\\\\\\\n   - Compute macro regime score using weighted L1 signals\\\\\\\\\\\\\\\\n   - Ticker universe: CAT, DE, UNP, HON, GE, BA, LMT, RTX, MMM, UPS\\\\\\\\\\\\\\\\n   - Output: sector recommendation with conviction calibrated by macro_score\\\\\\\\\\\\\\\\n   - Include startup check for L1 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l2/atlas_l2_industrials.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l2_industrials folder","done":false},{"description":"Agent reads all 10 L1 state files","done":false},{"description":"Ticker universe includes 10 industrial stocks","done":false}]
outputs: ["mission-control/outputs/I-025-CREATE-ATLAS-L2-INDUSTRIALS-AGENT-CLAUDE-MD-CLAUDE.md","mission-control/outputs/I-025-CREATE-ATLAS-L2-INDUSTRIALS-AGENT-CLAUDE-MD-output.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:36:39.759Z
started_at: 2026-03-15T15:13:51.253Z
completed_at: 2026-03-15T15:19:46.344Z
updated_at: 2026-03-15T15:21:37.102Z
due: 
---
