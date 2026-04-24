---
id: I-011-CREATE-ATLAS-L1-GEOPOLITICAL-AGENT-CLAUDE-MD
title: "Create atlas_l1_geopolitical agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_geopolitical/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Geopolitical risk analysis\\\\\\\\\\\\\\\\n   - Data sources: news_sentiment.json, dxy.json, macro_indicators.json, vix.json\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n   - Use atomic writes for JSON output\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_geopolitical.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_geopolitical folder","done":false},{"description":"Agent reads news_sentiment.json, dxy.json, macro_indicators.json, vix.json","done":false},{"description":"Output includes regime and conviction","done":false},{"description":"Holiday flag check implemented","done":false}]
outputs: ["mission-control/outputs/I-011-CREATE-ATLAS-L1-GEOPOLITICAL-AGENT-CLAUDE-MD-claude.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:33:52.940Z
started_at: 2026-03-15T10:53:55.522Z
completed_at: 2026-03-15T10:56:00.416Z
updated_at: 2026-03-15T10:57:19.552Z
due: 
---
