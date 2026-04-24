---
id: I-012-CREATE-ATLAS-L1-CHINA-AGENT-CLAUDE-MD
title: "Create atlas_l1_china agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_china/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Role: China market analysis\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Data sources: equity_quotes.json (FXI), dxy.json, news_sentiment.json\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_china.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_china folder","done":false},{"description":"Agent reads FXI quotes, dxy.json, news_sentiment.json","done":false},{"description":"Output includes regime and conviction","done":false}]
outputs: ["mission-control/outputs/I-012-CREATE-ATLAS-L1-CHINA-AGENT-CLAUDE-MD/CLAUDE.md","mission-control/outputs/I-012-CREATE-ATLAS-L1-CHINA-AGENT-CLAUDE-MD/atlas_l1_china.json"]
project: 
depends_on: []
retry_count: 1
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:33:59.550Z
started_at: 2026-03-15T11:03:16.248Z
completed_at: 2026-03-15T12:20:16.139Z
updated_at: 2026-03-15T12:28:01.096Z
due: 
---
