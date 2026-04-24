---
id: I-035-CREATE-ATLAS-MARKET-FETCHER-AGENT-CLAUDE-MD
title: "Create atlas_market_fetcher agent CLAUDE.md"
status: verified
priority: P1
worker_type: coding
origin: autonomous
initiative: I-BREAD-BAKER-PIPELINE-INFRASTRUCTURE
description: "1. Read /workspace/extra/bread-baker/IMPLEMENTATION_SPEC.md (Section 7.9).\\\\\\\\\\\\\\\\n2. Create group folder: nanoclaw/groups/atlas_market_fetcher/\\\\\\\\\\\\\\\\n3. Write CLAUDE.md:\\\\\\\\\\\\\\\\n   - Runs at 06:00\\\\\\\\\\\\\\\\n   - STEP 1: Read API keys from /workspace/extra/api-keys/api-keys.json\\\\\\\\\\\\\\\\n   - STEP 2: Check Alpaca /v2/clock for holiday detection FIRST\\\\\\\\\\\\\\\\n   - STEP 3: Broker sync - pull positions + account from Alpaca, write positions.json\\\\\\\\\\\\\\\\n   - STEP 4: Idempotency check - if data/market/{today}/ready.json exists, exit\\\\\\\\\\\\\\\\n   - STEP 5: Fetch all market data to data/market/{today}/\\\\\\\\\\\\\\\\n   - Ticker universe: semiconductors, energy, biotech, consumer, financials, tech_mega, sector_etfs, macro_etfs\\\\\\\\\\\\\\\\n   - API endpoints: FMP (quotes, treasury, VIX, DXY), FRED (UNRATE, CPI, GDP, ICSA), Finnhub (news)\\\\\\\\\\\\\\\\n   - STEP 6: Write data/market/{today}/ready.json AND data/market/ready.json (both - fixed path signal)\\\\\\\\\\\\\\\\n   - Data sources: API keys, Alpaca\\\\\\\\\\\\\\\\n   - Output: market data JSON files in /workspace/extra/market/{today}/"
acceptance_criteria: [{"description":"CLAUDE.md created in atlas_market_fetcher folder","done":false},{"description":"Holiday detection via Alpaca clock implemented","done":false},{"description":"Idempotency check prevents duplicate fetches","done":false},{"description":"All ticker universe covered (FMP, FRED, Finnhub)","done":false},{"description":"ready.json written to both dated and fixed paths","done":false}]
outputs: ["mission-control/outputs/I-035-CREATE-ATLAS-MARKET-FETCHER-AGENT-CLAUDE-MD.md"]
project: 
depends_on: []
retry_count: 0
revision_count: 0
blocked_reason: 
failure_reason: 
cancellation_reason: 
created_at: 2026-03-15T08:39:51.099Z
started_at: 2026-03-15T19:20:46.382Z
completed_at: 2026-03-15T19:24:51.387Z
updated_at: 2026-03-15T19:25:28.356Z
due: 
---
