---
id: I-009-CREATE-API-KEYS-CONFIGURATION-FILE
title: "Create API keys configuration file"
status: blocked
priority: P0
worker_type: admin
origin: autonomous
initiative: I-BREAD-BAKER-INFRASTRUCTURE
description: "For Bread Baker changes, DO NOT use a separate worktree or git branch. Work on the git repo as it is.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.6, Friction 6). Create ~/.config/bread-baker/api-keys.json with required API keys: FMP, Alpaca (paper), Finnhub, FRED. Ensure file mounted to containers at /workspace/extra/api-keys/api-keys.json."
acceptance_criteria: [{"description":"api-keys.json created at ~/.config/bread-baker/","done":false},{"description":"All required API keys included (FMP, Alpaca, Finnhub, FRED)","done":false},{"description":"File mounted to containers correctly","done":false}]
outputs: ["mission-control/outputs/I-009-CREATE-API-KEYS-CONFIGURATION-FILE-config.md"]
project: 
depends_on: []
retry_count: 1
revision_count: 2
blocked_reason: Cannot create /workspace/extra/api-keys/ mount point - requires host-side directory creation and Docker mount configuration
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:32:10.304Z
started_at: 2026-03-15T10:58:33.093Z
completed_at: 2026-03-15T21:42:53.760Z
updated_at: 2026-03-15T22:17:49.264Z
due: 
---
