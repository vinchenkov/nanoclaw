---
id: I-010-CREATE-ATLAS-L1-CENTRAL-BANK-AGENT-CLAUDE-MD
title: "Create atlas_l1_central_bank agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L1-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7, Phase 2).\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l1_central_bank/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n3. Write CLAUDE.md following the standard template:\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Role: Central bank policy analysis\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Data sources: yield_curve.json, macro_indicators.json, dxy.json\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Output: regime classification (RISK_ON/RISK_OFF) with conviction score\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Include startup check for holiday flag\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n   - Use atomic writes for JSON output\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l1/atlas_l1_central_bank.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l1_central_bank folder","done":false},{"description":"Agent reads yield_curve.json and macro_indicators.json","done":false},{"description":"Output includes regime and conviction","done":false},{"description":"Holiday flag check implemented","done":false}]
outputs: ["mission-control/outputs/I-010-atlas_l1_central_bank.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 1
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:33:34.850Z
started_at: 2026-03-15T10:38:26.051Z
completed_at: 2026-03-15T10:43:34.591Z
updated_at: 2026-03-15T10:46:58.482Z
due: 
---
