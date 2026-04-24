---
id: I-019-CREATE-ATLAS-L1-INSTITUTIONAL-FLOW-AGENT-CLAUDE-MD
title: "Create atlas_l1_institutional_flow agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2, L1 Agent Data Source Mapping).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_institutional_flow/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Institutional flow analysis (uses volume anomalies and sector ETF flows as proxies)\\\\\\\\\\\\\\\\n   - Data sources: equity_quotes.json (volume data), sector_etfs.json, news_sentiment.json\\\\\\\\\\\\\\\\n   - Note: Direct institutional flow data updates quarterly (13F), use volume anomalies as proxy\\\\\\\\\\\\\\\\n   - Output: regime classification with conviction\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_institutional_flow.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_institutional_flow folder","done":false},{"description":"Agent reads volume data and sector ETF flows","done":false},{"description":"Output includes regime and conviction","done":false},{"description":"Notes quarterly 13F limitation in CLAUDE.md","done":false}]
outputs: ["mission-control/outputs/I-019-CREATE-ATLAS-L1-INSTITUTIONAL-FLOW-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:35:12.820Z
started_at: 2026-03-15T14:30:35.335Z
completed_at: 2026-03-15T14:34:52.373Z
updated_at: 2026-03-15T14:36:05.753Z
due: 
---
