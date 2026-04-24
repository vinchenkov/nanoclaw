---
id: I-034-CREATE-ATLAS-L4-AUTONOMOUS-EXECUTION-AGENT-CLAUDE-MD
title: "Create atlas_l4_autonomous_execution agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L4-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.11).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l4_autonomous_execution/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Execute trades via Alpaca API\\\\\\\\\\\\\\\\n   - STEP 1 - Pipeline integrity check (24 files):\\\\\\\\\\\\\\\\n     * 10 L1 state files, 7 L2 state files, 4 L3 state files\\\\\\\\\\\\\\\\n     * CRO, Alpha Discovery, portfolio_actions = 3 more\\\\\\\\\\\\\\\\n     * Check each exists and has todays date\\\\\\\\\\\\\\\\n     * If holiday flagged anywhere, skip trading (expected, no alert)\\\\\\\\\\\\\\\\n     * If missing non-holiday files: alert to Discord and exit\\\\\\\\\\\\\\\\n   - STEP 2 - Execute orders:\\\\\\\\\\\\\\\\n     * For each action in portfolio_actions.json\\\\\\\\\\\\\\\\n     * HOLD: skip\\\\\\\\\\\\\\\\n     * BUY/SELL: submit limit order with extended_hours: false, time_in_force: day\\\\\\\\\\\\\\\\n     * Log submissions to orders_log.jsonl\\\\\\\\\\\\\\\\n   - STEP 3 - Re-pull positions from Alpaca\\\\\\\\\\\\\\\\n   - Order settings: time_in_force: day, extended_hours: false\\\\\\\\\\\\\\\\n   - Data sources: /workspace/extra/state/l4/portfolio_actions.json, /workspace/extra/api-keys/\\\\\\\\\\\\\\\\n4. No user-visible output (wrap in <internal> tags)"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l4_autonomous_execution folder","done":false},{"description":"24-file pipeline integrity check implemented","done":false},{"description":"Holiday flag handling implemented","done":false},{"description":"Order execution via Alpaca API implemented","done":false},{"description":"extended_hours: false enforced","done":false}]
outputs: ["mission-control/outputs/I-034-CREATE-ATLAS-L4-AUTONOMOUS-EXECUTION-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:39:08.288Z
started_at: 2026-03-15T18:58:17.449Z
completed_at: 2026-03-15T19:02:29.053Z
updated_at: 2026-03-15T19:04:03.403Z
due: 
---
