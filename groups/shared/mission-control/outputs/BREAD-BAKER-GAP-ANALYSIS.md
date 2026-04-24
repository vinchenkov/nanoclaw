# Bread Baker Gap Analysis Report

**Analysis Date:** 2026-03-15
**Spec Version:** IMPLEMENTATION_SPEC.md v2
**Target:** NanoClaw at `/workspace/extra/bread-baker/nanoclaw/`

---

## Executive Summary

The Bread Baker implementation has significant progress but contains **critical gaps** that prevent end-to-end pipeline execution. The most critical missing components are:

1. **Scheduler dependency-gated execution** - Core infrastructure not implemented
2. **Missing agent groups** - 2 of 30 required agents not created
3. **Schema non-conformance** - Agent outputs don't match canonical schemas
4. **Config/mount infrastructure** - Missing mount-allowlist and api-keys
5. **Dockerfile gaps** - Missing numpy and jq dependencies

---

## 1. Missing Agents (Critical)

### 1.1 L3 Aschenbrenner Agent
- **Status:** Not created
- **Spec Requirement:** `atlas_l3_aschenbrenner/CLAUDE.md`
- **Purpose:** AI/compute secular thesis agent

### 1.2 L4 CIO Agent
- **Status:** Not created (referenced in register script but group folder missing)
- **Spec Requirement:** `atlas_l4_cio/CLAUDE.md`
- **Purpose:** Chief Investment Officer - synthesizes portfolio actions

---

## 2. Scheduler & Database Gaps (Critical)

### 2.1 Missing Database Columns
**File:** `src/db.ts`

The following columns are NOT in the `scheduled_tasks` table:
- `depends_on_signals` (TEXT) - JSON array of absolute file paths
- `depends_on_deadline` (TEXT) - NY time deadline

**Current schema only has:**
- id, group_folder, chat_jid, prompt, schedule_type, schedule_value, next_run, last_run, last_result, status, created_at, context_mode

### 2.2 Missing Task Runs Table
**File:** `src/db.ts`

The `task_runs` table specified in Section 5 does NOT exist:
```sql
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  trading_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  UNIQUE(task_id, trading_date)
);
```

### 2.3 Scheduler Missing Dependency Logic
**File:** `src/task-scheduler.ts`

The scheduler does NOT implement:
- `dependenciesMet()` function
- `pastDeadline()` function
- Dependency-gated task filtering
- Deadline expiration handling
- Task state machine transitions

The `getDueTasks()` in `db.ts` does not filter by dependencies or deadlines.

### 2.4 Config Not Reading Env Variable
**File:** `src/config.ts` (line 17)

```typescript
// CURRENT (hardcoded):
export const SCHEDULER_POLL_INTERVAL = 60000;

// SHOULD BE (from env):
export const SCHEDULER_POLL_INTERVAL = parseInt(
  process.env.SCHEDULER_POLL_INTERVAL || '15000', 10
);
```

Note: The `.env` file correctly has `SCHEDULER_POLL_INTERVAL=15000` but config.ts ignores it.

---

## 3. Schema Non-Conformance (High)

### 3.1 L1 Output Schema Missing Fields
**Current:** `/workspace/extra/bread-baker/nanoclaw/data/state/l1/atlas_l1_china.json`
```json
{
  "agent": "atlas_l1_china",
  "regime": "NEUTRAL",
  "regime_conviction": 50,
  "signals": {...},
  "rationale": "...",
  "last_updated": "..."
}
```

**Spec Requires (Section 3.1):**
```json
{
  "agent": "atlas_l1_{name}",
  "date": "2026-03-16",           // MISSING
  "regime": "RISK_ON | ...",
  "regime_conviction": 55,
  "proxy_etf": "XLF",             // MISSING
  "proxy_direction": "LONG",       // MISSING
  "key_signals": {},               // Should be key_signals, not signals
  "analysis_summary": "...",       // MISSING (should replace rationale)
  "last_updated": "..."
}
```

**All L1 agents affected:** All 10 agents missing `date`, `proxy_etf`, `proxy_direction`, `analysis_summary`

### 3.2 L2 Output Schema Missing Fields
**Current:** `/workspace/extra/bread-baker/nanoclaw/data/state/l2/atlas_l2_semiconductor.json`
```json
{
  "agent": "atlas_l2_semiconductor",
  "regime": "NEUTRAL",
  "regime_conviction": 50,
  "macro_score": 0.0,
  "signals": {...},
  "ticker_universe": [...],
  "top_picks": [],
  "rationale": "...",
  "last_updated": "..."
}
```

**Spec Requires (Section 3.2):**
```json
{
  "agent": "atlas_l2_{sector}",
  "date": "2026-03-16",              // MISSING
  "macro_score": 0.089,
  "sector_view": "OVERWEIGHT | ...", // MISSING (not regime)
  "sector_conviction": 72,           // MISSING (not regime_conviction)
  "top_picks": [
    {"ticker": "NVDA", "direction": "LONG", "conviction": 85, "rationale": "..."}
  ],
  "last_updated": "2026-03-16T10:12:00Z"
}
```

**All L2 agents affected:** All 7 agents missing `date`, `sector_view`, `sector_conviction`

---

## 4. Infrastructure Gaps (High)

### 4.1 Missing Mount Allowlist
**Expected Location:** `~/.config/bread-baker/mount-allowlist.json`

Not created. Required for non-main groups to write to shared mounts.

### 4.2 Missing API Keys File
**Expected Location:** `~/.config/bread-baker/api-keys.json`

Not created. Required schema:
```json
{
  "FMP_KEY": "...",
  "FINNHUB_KEY": "...",
  "FRED_KEY": "...",
  "ALPACA_KEY": "...",
  "ALPACA_SECRET": "...",
  "ALPACA_BASE_URL": "https://paper-api.alpaca.markets"
}
```

### 4.3 Dockerfile Missing Dependencies
**File:** `container/Dockerfile`

Missing per Section 7.4:
```dockerfile
# Missing - numpy for scorecard_math.py
RUN pip3 install numpy --quiet

# Missing - jq for JSON processing
RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*

# Missing - git identity for autoresearch
RUN git config --global user.name "ATLAS Autoresearch" && \
    git config --global user.email "autoresearch@atlas.local"
```

---

## 5. Data Directory Issues (Medium)

### 5.1 Portfolio Directory Empty
**Path:** `/workspace/extra/bread-baker/nanoclaw/data/portfolio/`

- `positions.json` - NOT created (should be populated by market fetcher)
- `orders_log.jsonl` - Created (empty, correct)
- `hwm.json` - Created in wrong location (`data/state/hwm.json` instead of `data/portfolio/hwm.json`)

### 5.2 L3 and L4 State Empty
**Path:** `/workspace/extra/bread-baker/nanoclaw/data/state/`

- `l3/` - Empty (no L3 agents have run)
- `l4/` - Empty (no L4 agents have run)

### 5.3 L1 State Incomplete
**Path:** `/workspace/extra/bread-baker/nanoclaw/data/state/l1/`

Only 6 of 10 L1 agents have produced output:
- Present: china, commodities, dollar, news_sentiment, volatility, yield_curve
- Missing: central_bank, geopolitical, emerging_markets, institutional_flow

---

## 6. Register Script Issues (Medium)

### 6.1 ATLAS_OUTPUT_JID Not Configured
**File:** `scripts/register-atlas-groups.ts` (line 11)

```typescript
// CURRENT:
const ATLAS_OUTPUT_JID = 'TODO_REPLACE_WITH_CHANNEL_ID';

// Should be: dc:ATLAS_CHANNEL_ID_HERE after Discord channel creation
```

### 6.2 Script Defines But Doesn't Use Dependencies
The register script defines `dependsOnSignals` and `dependsOnDeadline` in task definitions, but:
- These fields are not in the database schema
- The scheduler doesn't read them
- They are effectively unused

---

## 7. Agent CLAUDE.md Issues

### 7.1 Missing L1 Agents (2)
- All 10 L1 groups exist with CLAUDE.md - ✓

### 7.2 Missing L2 Agents (0)
- All 7 L2 groups exist with CLAUDE.md - ✓

### 7.3 Missing L3 Agents (1)
- `atlas_l3_aschenbrenner/CLAUDE.md` - NOT CREATED

### 7.4 Missing L4 Agents (1)
- `atlas_l4_cio/CLAUDE.md` - NOT CREATED

### 7.5 Missing Infrastructure Agents (0)
- All 5 infrastructure groups exist with CLAUDE.md - ✓
  - atlas_market_fetcher
  - atlas_scorecard
  - atlas_autoresearch
  - atlas_autoresearch_evaluator
  - atlas_pipeline_watchdog

---

## 8. Scripts Status

### 8.1 scorecard_math.py
**Status:** Created and matches spec - ✓
**Location:** `scripts/scorecard_math.py`

Implements:
- Layer-based pooling (L1, L2, L3, L4)
- Sharpe calculation with numpy
- Weight boost/decay logic
- Proper min returns thresholds

### 8.2 register-atlas-groups.ts
**Status:** Created but has issues (see 6.1, 6.2)
**Location:** `scripts/register-atlas-groups.ts`

---

## 9. Environment Configuration

### 9.1 .env File
**Status:** Correctly configured - ✓
```
MAX_CONCURRENT_CONTAINERS=30
SCHEDULER_POLL_INTERVAL=15000
```

### 9.2 Config.ts
**Status:** Not reading SCHEDULER_POLL_INTERVAL from env - ✗
**Impact:** Poll interval remains at 60000ms despite .env setting

---

## 10. Pipeline Execution Status

### 10.1 What Has Run
- Market Fetcher: Not verified
- L1 Agents: 6 of 10 have produced initial state files
- L2 Agents: 7 of 7 have produced initial state files
- L3 Agents: Not run
- L4 Agents: Not run

### 10.2 What Has NOT Run
- Scorecard (scheduled for 18:00)
- Autoresearch (scheduled for 20:00)
- Autoresearch Evaluator (scheduled for 20:30 Monday)
- Pipeline Watchdog (scheduled for 09:30)

---

## Summary of Required Fixes

| Priority | Component | Issue | Count |
|----------|-----------|-------|-------|
| Critical | Database | Add depends_on_signals, depends_on_deadline columns | 1 |
| Critical | Database | Create task_runs table | 1 |
| Critical | Scheduler | Implement dependency-gated execution | 1 |
| Critical | Groups | Create atlas_l3_aschenbrenner | 1 |
| Critical | Groups | Create atlas_l4_cio | 1 |
| High | Config | Read SCHEDULER_POLL_INTERVAL from env | 1 |
| High | Schema | L1 agents missing date, proxy_etf, proxy_direction, key_signals | 10 |
| High | Schema | L2 agents missing date, sector_view, sector_conviction | 7 |
| High | Infrastructure | Create ~/.config/bread-baker/mount-allowlist.json | 1 |
| High | Infrastructure | Create ~/.config/bread-baker/api-keys.json | 1 |
| High | Dockerfile | Add numpy, jq, git config | 1 |
| Medium | Data | Fix hwm.json location (data/portfolio vs data/state) | 1 |
| Medium | Register Script | Replace ATLAS_OUTPUT_JID placeholder | 1 |

---

## Recommendations

1. **Immediate (Critical Path):**
   - Add database columns for dependency scheduling
   - Implement dependency-gated execution in scheduler
   - Create missing L3 Aschenbrenner and L4 CIO agents

2. **High Priority:**
   - Create mount-allowlist.json and api-keys.json
   - Update Dockerfile with numpy/jq
   - Fix config.ts to read env variables
   - Update all L1/L2 CLAUDE.md to output correct schemas

3. **Medium Priority:**
   - Fix hwm.json path
   - Complete L1 agent runs
   - Run through full pipeline end-to-end
