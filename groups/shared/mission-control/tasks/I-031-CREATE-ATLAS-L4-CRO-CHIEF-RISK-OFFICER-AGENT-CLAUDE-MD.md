---
id: I-031-CREATE-ATLAS-L4-CRO-CHIEF-RISK-OFFICER-AGENT-CLAUDE-MD
title: "Create atlas_l4_cro (Chief Risk Officer) agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-L4-AGENTS
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.11, Section 7.7).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_l4_cro/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Role: Adversarial risk review. Check for concentration risks, sector overexposure, and position size violations.\\\\\\\\\\\\\\\\n   - Philosophy: Flag positions that exceed concentration limits (max 15% single position, 30% sector). Flag EXIT_IMMEDIATELY for positions down > 20%.\\\\\\\\\\\\\\\\n   - Data sources: Read L3 recommendations from /workspace/extra/state/l3/, positions from /workspace/extra/portfolio/positions.json\\\\\\\\\\\\\\\\n   - Output: Risk flags and concentration warnings. Excluded from Darwinian weights.\\\\\\\\\\\\\\\\n   - Include startup check for L3 signals ready and holiday flag\\\\\\\\\\\\\\\\n4. Write output to /workspace/extra/state/l4/atlas_l4_cro.json"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_l4_cro folder","done":false},{"description":"Agent implements concentration risk checks","done":false},{"description":"Agent flags EXIT_IMMEDIATE for 20%+ drawdown","done":false},{"description":"Excluded from Darwinian weights","done":false}]
outputs: ["mission-control/outputs/I-031-atlas-l4-cro-output.json"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:38:39.430Z
started_at: 2026-03-15T17:59:39.819Z
completed_at: 2026-03-15T18:04:09.627Z
updated_at: 2026-03-15T18:05:38.853Z
due: 
---
