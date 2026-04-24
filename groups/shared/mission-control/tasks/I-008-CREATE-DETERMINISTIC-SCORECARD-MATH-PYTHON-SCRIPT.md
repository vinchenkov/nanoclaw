---
id: I-008-CREATE-DETERMINISTIC-SCORECARD-MATH-PYTHON-SCRIPT
title: "Create deterministic scorecard math Python script"
status: verified
priority: P0
worker_type: admin
origin: autonomous
initiative: I-BREAD-BAKER-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.5).\\\\\\\\\\\\\\\\n2. Create nanoclaw/scripts/scorecard_math.py with:\\\\\\\\\\\\\\\\n   - Layer pools for L1, L2, L3, L4 agents\\\\\\\\\\\\\\\\n   - Sharpe calculation using numpy (rolling 60-record)\\\\\\\\\\\\\\\\n   - Darwinian weight update logic (boost top 25%, decay bottom 25%)\\\\\\\\\\\\\\\\n   - MIN_RETURNS_FOR_ACTIVE=20\\\\\\\\\\\\\\\\n   - MIN_ACTIVE_AGENTS_FOR_WEIGHT_UPDATE=3\\\\\\\\\\\\\\\\n   - WEIGHT_BOOST=1.05, WEIGHT_DECAY=0.95\\\\\\\\\\\\\\\\n   - WEIGHT_CAP=2.5, WEIGHT_FLOOR=0.3\\\\\\\\\\\\\\\\n3. Script should read recommendations from JSONL files and output updated scores and weights"
acceptance_criteria: [{"description":"scorecard_math.py created in nanoclaw/scripts/","done":false},{"description":"Sharpe calculation implemented correctly","done":false},{"description":"Darwinian weight update logic implemented","done":false},{"description":"Layer pools properly defined","done":false}]
outputs: ["task/I-008"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:32:03.100Z
started_at: 2026-03-15T09:29:55.460Z
completed_at: 2026-03-15T09:33:06.857Z
updated_at: 2026-03-15T09:34:48.023Z
due: 
---
