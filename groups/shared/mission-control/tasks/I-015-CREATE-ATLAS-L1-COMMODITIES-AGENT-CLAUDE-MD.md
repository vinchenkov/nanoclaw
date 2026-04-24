---
id: I-015-CREATE-ATLAS-L1-COMMODITIES-AGENT-CLAUDE-MD
title: "Create atlas_l1_commodities agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_commodities/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Commodities market analysis\\\\\\\\\\\\\\\\n   - Data sources: equity_quotes.json (GLD, USO), dxy.json, news_sentiment.json\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_commodities.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_commodities folder","done":false},{"description":"Agent reads GLD and USO quotes, dxy.json","done":false},{"description":"Output includes regime and conviction","done":false}]
outputs: ["task/I-015-CREATE-ATLAS-L1-COMMODITIES-AGENT-CLAUDE-MD"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:34:19.516Z
started_at: 2026-03-15T12:47:37.585Z
completed_at: 2026-03-15T12:51:50.358Z
updated_at: 2026-03-15T12:53:30.315Z
due: 
---
