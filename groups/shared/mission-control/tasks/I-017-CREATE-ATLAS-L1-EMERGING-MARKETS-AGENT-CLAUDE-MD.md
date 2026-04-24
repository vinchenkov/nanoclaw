---
id: I-017-CREATE-ATLAS-L1-EMERGING-MARKETS-AGENT-CLAUDE-MD
title: "Create atlas_l1_emerging_markets agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_emerging_markets/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Emerging markets analysis\\\\\\\\\\\\\\\\n   - Data sources: equity_quotes.json (EEM, FXI), dxy.json, news_sentiment.json\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_emerging_markets.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_emerging_markets folder","done":false},{"description":"Agent reads EEM and FXI quotes, dxy.json","done":false},{"description":"Output includes regime and conviction","done":false}]
outputs: ["mission-control/outputs/I-017-atlas_l1_emerging_markets.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:34:58.597Z
started_at: 2026-03-15T12:59:11.168Z
completed_at: 2026-03-15T13:03:51.610Z
updated_at: 2026-03-15T13:06:29.988Z
due: 
---
