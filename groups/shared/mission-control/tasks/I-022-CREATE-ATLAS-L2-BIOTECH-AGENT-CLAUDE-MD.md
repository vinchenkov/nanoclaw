---
id: I-022-CREATE-ATLAS-L2-BIOTECH-AGENT-CLAUDE-MD
title: "Create atlas_l2_biotech agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L2-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L2 Aggregation Formula).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l2_biotech/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Biotech sector analysis\\\\\\\\\\\\\\\\n   - Data sources: Read all 10 L1 state files from /workspace/extra/state/l1/\\\\\\\\\\\\\\\\n   - Compute macro regime score using weighted L1 signals\\\\\\\\\\\\\\\\n   - Ticker universe: MRNA, PFE, LLY, BMY, ABBV, AMGN, GILD, REGN, VRTX, BIIB\\\\\\\\\\\\\\\\n   - Output: sector recommendation with conviction calibrated by macro_score\\\\\\\\\\\\\\\\n   - Include startup check for L1 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l2/atlas_l2_biotech.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l2_biotech folder","done":false},{"description":"Agent reads all 10 L1 state files","done":false},{"description":"Ticker universe includes 10 biotech stocks","done":false}]
outputs: ["mission-control/outputs/I-022-CREATE-ATLAS-L2-BIOTECH-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:36:14.348Z
started_at: 2026-03-15T14:54:47.508Z
completed_at: 2026-03-15T14:57:22.996Z
updated_at: 2026-03-15T14:58:39.044Z
due: 
---
