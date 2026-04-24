---
id: I-020-CREATE-ATLAS-L2-SEMICONDUCTOR-AGENT-CLAUDE-MD
title: "Create atlas_l2_semiconductor agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L2-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L2 Aggregation Formula).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l2_semiconductor/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Semiconductor sector analysis\\\\\\\\\\\\\\\\n   - Data sources: Read all 10 L1 state files from /workspace/extra/state/l1/\\\\\\\\\\\\\\\\n   - Compute macro regime score using weighted L1 signals:\\\\\\\\\\\\\\\\n     * Read darwinian_weights.json for agent weights\\\\\\\\\\\\\\\\n     * Apply formula: macro_score = weighted_sum / weight_total\\\\\\\\\\\\\\\\n   - Ticker universe: NVDA, AMD, TSM, INTC, AMAT, ASML, KLAC, LRCX, MRVL, AVGO\\\\\\\\\\\\\\\\n   - Output: sector recommendation with conviction calibrated by macro_score\\\\\\\\\\\\\\\\n   - Include startup check for L1 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l2/atlas_l2_semiconductor.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l2_semiconductor folder","done":false},{"description":"Agent reads all 10 L1 state files","done":false},{"description":"Macro score formula implemented correctly","done":false},{"description":"Ticker universe includes 10 semiconductor stocks","done":false}]
outputs: ["task/I-020-CREATE-ATLAS-L2-SEMICONDUCTOR-AGENT-CLAUDE-MD","mission-control/outputs/I-020-atlas_l2_semiconductor-state.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:35:34.929Z
started_at: 2026-03-15T14:37:48.687Z
completed_at: 2026-03-15T14:42:37.023Z
updated_at: 2026-03-15T14:43:34.422Z
due: 
---
