---
id: I-013-CREATE-ATLAS-L1-DOLLAR-AGENT-CLAUDE-MD
title: "Create atlas_l1_dollar agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_dollar/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: US Dollar strength analysis\\\\\\\\\\\\\\\\n   - Data sources: dxy.json, equity_quotes.json (EEM, GLD), macro_indicators.json\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_dollar.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_dollar folder","done":false},{"description":"Agent reads dxy.json, EEM and GLD quotes","done":false},{"description":"Output includes regime and conviction","done":false}]
outputs: ["mission-control/outputs/I-013-CREATE-ATLAS-L1-DOLLAR-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:34:06.140Z
started_at: 2026-03-15T12:28:44.436Z
completed_at: 2026-03-15T12:35:15.550Z
updated_at: 2026-03-15T12:36:51.852Z
due: 
---
