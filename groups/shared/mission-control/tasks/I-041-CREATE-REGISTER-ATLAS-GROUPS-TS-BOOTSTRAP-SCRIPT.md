---
id: I-041-CREATE-REGISTER-ATLAS-GROUPS-TS-BOOTSTRAP-SCRIPT
title: "Create register-atlas-groups.ts bootstrap script"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-BOOTSTRAP
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 3).\\\\\\\\\\\\\\\\n2. Create nanoclaw/scripts/register-atlas-groups.ts with:\\\\\\\\\\\\\\\\n   - All 25 ATLAS groups (10 L1, 7 L2, 4 L3, 4 L4 infrastructure)\\\\\\\\\\\\\\\\n   - Market fetcher, scorecard, autoresearch, autoresearch_evaluator, watchdog\\\\\\\\\\\\\\\\n   - Each with correct cron schedule:\\\\\\\\\\\\\\\\n     * Market fetcher: 0 6 * * 1-5\\\\\\\\\\\\\\\\n     * L1-L4 agents: 0 6 * * 1-5\\\\\\\\\\\\\\\\n     * Watchdog: 30 9 * * 1-5\\\\\\\\\\\\\\\\n     * Scorecard: 0 18 * * 1-5\\\\\\\\\\\\\\\\n     * Autoresearch: 0 20 * * 1-5\\\\\\\\\\\\\\\\n     * Autoresearch evaluator: 30 20 * * 1\\\\\\\\\\\\\\\\n   - Dependency gates:\\\\\\\\\\\\\\\\n     * L1 depends on market/ready.json\\\\\\\\\\\\\\\\n     * L2 depends on all L1 signals\\\\\\\\\\\\\\\\n     * L3 depends on all L2 signals\\\\\\\\\\\\\\\\n     * CRO/Alpha depend on L3 signals\\\\\\\\\\\\\\\\n     * CIO depends on CRO + Alpha\\\\\\\\\\\\\\\\n     * AE depends on portfolio_actions.json\\\\\\\\\\\\\\\\n   - Mount configurations for each group\\\\\\\\\\\\\\\\n   - Timeout settings (600000 for agents, 120000 for watchdog)\\\\\\\\\\\\\\\\n3. Run with: npx tsx scripts/register-atlas-groups.ts"
acceptance_criteria: [{"description":"register-atlas-groups.ts created","done":false},{"description":"All 25+ groups registered with correct schedules","done":false},{"description":"Dependency gates configured correctly","done":false},{"description":"Mount configurations set per group","done":false}]
outputs: ["mission-control/outputs/I-041-CREATE-REGISTER-ATLAS-GROUPS-TS-BOOTSTRAP-SCRIPT.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:41:25.446Z
started_at: 2026-03-15T20:09:21.970Z
completed_at: 2026-03-15T20:14:19.315Z
updated_at: 2026-03-15T20:16:00.111Z
due: 
---
