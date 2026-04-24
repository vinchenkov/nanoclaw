---
id: I-024-CREATE-ATLAS-L2-FINANCIALS-AGENT-CLAUDE-MD
title: "Create atlas_l2_financials agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L2-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L2 Aggregation Formula).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l2_financials/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Financials sector analysis\\\\\\\\\\\\\\\\n   - Data sources: Read all 10 L1 state files from /workspace/extra/state/l1/\\\\\\\\\\\\\\\\n   - Compute macro regime score using weighted L1 signals\\\\\\\\\\\\\\\\n   - Ticker universe: JPM, GS, MS, BAC, WFC, BLK, SCHW, AXP, C, USB\\\\\\\\\\\\\\\\n   - Output: sector recommendation with conviction calibrated by macro_score\\\\\\\\\\\\\\\\n   - Include startup check for L1 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l2/atlas_l2_financials.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l2_financials folder","done":false},{"description":"Agent reads all 10 L1 state files","done":false},{"description":"Ticker universe includes 10 financial stocks","done":false}]
outputs: ["task/I-024-CREATE-ATLAS-L2-FINANCIALS-AGENT-CLAUDE-MD"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:36:31.466Z
started_at: 2026-03-15T15:05:38.635Z
completed_at: 2026-03-15T15:10:46.771Z
updated_at: 2026-03-15T15:13:13.409Z
due: 
---
