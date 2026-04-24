---
id: I-036-CREATE-ATLAS-SCORECARD-AGENT-CLAUDE-MD
title: "Create atlas_scorecard agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-PIPELINE-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.10).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_scorecard/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Runs at 18:00\\\\\\\\\\\\\\\\n   - STEP 1: Broker sync - pull EOD positions, overwrite positions.json\\\\\\\\\\\\\\\\n   - STEP 2: HWM update - if portfolio_value > high_water_mark, update hwm.json\\\\\\\\\\\\\\\\n   - STEP 3: Order status reconciliation - pull todays orders from Alpaca, append to orders_log.jsonl\\\\\\\\\\\\\\\\n   - STEP 4: Generate fill records - for each recommendation from 5 trading days ago without fill:\\\\\\\\\\\\\\\\n     * Fetch entry price (close on rec date) from FMP\\\\\\\\\\\\\\\\n     * Fetch exit price (close today) from FMP batch\\\\\\\\\\\\\\\\n     * Calculate forward_return_5d\\\\\\\\\\\\\\\\n     * Append fill record to agent JSONL\\\\\\\\\\\\\\\\n   - STEP 5: Run scorecard_math.py to update agent_scores.json and darwinian_weights.json\\\\\\\\\\\\\\\\n   - Data sources: /workspace/extra/portfolio/, /workspace/extra/scorecard/recommendations/, repo scripts\\\\\\\\\\\\\\\\n   - API calls: ~1 FMP batch + ~20 individual historical (stay within 50 call budget)"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_scorecard folder","done":false},{"description":"HWM update implemented","done":false},{"description":"Fill record generation implemented","done":false},{"description":"scorecard_math.py invoked correctly","done":false},{"description":"API budget respected (<= 50 FMP calls)","done":false}]
outputs: ["mission-control/outputs/I-036-CREATE-ATLAS-SCORECARD-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:40:03.483Z
started_at: 2026-03-15T19:26:18.747Z
completed_at: 2026-03-15T19:29:02.822Z
updated_at: 2026-03-15T19:31:01.807Z
due: 
---
