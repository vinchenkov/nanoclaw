---
id: I-039-CREATE-ATLAS-PIPELINE-WATCHDOG-AGENT-CLAUDE-MD
title: "Create atlas_pipeline_watchdog agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-PIPELINE-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.12).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_pipeline_watchdog/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Runs at 09:30 every weekday\\\\\\\\\\\\\\\\n   - STEP 1: Check if /workspace/extra/state/l4/portfolio_actions.json exists with last_updated = today\\\\\\\\\\\\\\\\n   - STEP 2: Check /workspace/extra/market/ready.json for \\\\\\\\\\\\\\\"holiday\\\\\\\\\\\\\\\": true\\\\\\\\\\\\\\\\n   - If holiday: do nothing (expected)\\\\\\\\\\\\\\\\n   - STEP 3: If portfolio_actions exists and not holiday: exit silently (pipeline completed)\\\\\\\\\\\\\\\\n   - STEP 4: If portfolio_actions missing and not holiday: send Discord alert\\\\\\\\\\\\\\\\n     \\\\\\\\\\\\\\\"⚠️ ATLAS pipeline did not complete by 09:30. Check logs.\\\\\\\\\\\\\\\"\\\\\\\\\\\\\\\\n   - Wrap all output in <internal> tags except the alert"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_pipeline_watchdog folder","done":false},{"description":"Portfolio actions check implemented","done":false},{"description":"Holiday handling implemented","done":false},{"description":"Discord alert on pipeline failure","done":false}]
outputs: ["mission-control/outputs/atlas_pipeline_watchdog.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:40:35.994Z
started_at: 2026-03-15T19:38:25.244Z
completed_at: 2026-03-15T19:41:23.814Z
updated_at: 2026-03-15T19:43:22.000Z
due: 
---
