---
id: I-016-CREATE-ATLAS-L1-VOLATILITY-AGENT-CLAUDE-MD
title: "Create atlas_l1_volatility agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_volatility/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Volatility regime analysis\\\\\\\\\\\\\\\\n   - Data sources: vix.json, equity_quotes.json (SPY)\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_volatility.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_volatility folder","done":false},{"description":"Agent reads vix.json and SPY quotes","done":false},{"description":"Output includes regime and conviction","done":false}]
outputs: ["mission-control/outputs/I-016-create-atlas-l1-volatility-agent.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:34:26.369Z
started_at: 2026-03-15T12:54:15.458Z
completed_at: 2026-03-15T12:57:37.900Z
updated_at: 2026-03-15T12:58:29.528Z
due: 
---
