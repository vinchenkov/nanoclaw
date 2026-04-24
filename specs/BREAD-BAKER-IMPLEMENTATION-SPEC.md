# Bread-Baker Implementation Spec v2
## ATLAS-GIC on NanoClaw

*This document is the implementation specification for another agent to execute. It supersedes the v1 spec and addresses all gaps surfaced by four independent simulation runs. Read the RESEARCH_REPORT.md for architectural context.*

---

## 0. Philosophy

This is a one-of-one piece of software. It has no upstream to stay compatible with, no users to avoid breaking, no distribution constraints. NanoClaw is the starting point — a canvas, not a framework. The codebase is yours entirely.

Build the most robust, simplified version of this investment pipeline. If the spec's architectural decisions conflict with a cleaner implementation, ignore the spec and build it cleaner. Restructure the scheduler, rewrite the database schema, change the Dockerfile, gut and replace any NanoClaw subsystem that gets in the way. The only things that matter are correctness, reliability, and simplicity of the investment system itself.

---

## 1. Target State

A daily batch investment pipeline running inside NanoClaw (bread-baker), consisting of:
- 25 ATLAS agents as NanoClaw groups (L1–L4)
- 5 infrastructure groups (market fetcher, scorecard updater, autoresearch orchestrator, autoresearch evaluator, pipeline watchdog)
- Shared host-side data directories mounted into all containers
- Dependency-signal-gated scheduling with deadlines and a proper task state machine
- Darwinian weight system tracked in `data/scorecard/darwinian_weights.json`, scored per-layer
- Autoresearch loop that evolves agent CLAUDE.md prompts via direct commits to `main` (no branches)
- CIO daily output delivered to a dedicated Discord channel

---

## 2. Core Contracts

These contracts are referenced throughout the spec. Every agent, script, and schema must conform to them.

### 2.1 Date and Timezone Contract

**All dates and timestamps use UTC.** No exceptions.

- Agents determine today's date via `date -u +%Y-%m-%d`
- Timestamps use ISO 8601 UTC: `date -u +%Y-%m-%dT%H:%M:%SZ`
- The scheduler computes `today` as `new Date().toISOString().split('T')[0]` (UTC)
- Docker containers default to UTC — this is correct; do not set `TZ` in containers
- Cron expressions use America/New_York timezone (via `cron-parser`'s `tz` option) for scheduling, but all data written by agents uses UTC dates
- The `trading_date` is the NYSE calendar date in America/New_York. For the morning pipeline (06:00 ET = 10:00/11:00 UTC), the UTC date matches the ET date. For the evening pipeline (18:00-20:00 ET), UTC may have rolled to the next day during DST transitions — agents must use `date -u` consistently and the scheduler's `today` is authoritative.

**Standard CLAUDE.md date instructions** (include in every agent):
```
Always use UTC for dates and timestamps:
- Today's date: date -u +%Y-%m-%d
- Current timestamp: date -u +%Y-%m-%dT%H:%M:%SZ
```

### 2.2 Atomic Write Contract

All JSON output files must be written atomically to prevent downstream agents from reading corrupt/partial data:

```bash
# Write to temp file first, then atomic move
echo '{"key": "value", ...}' > /workspace/extra/state/l1/atlas_l1_central_bank.json.tmp
mv /workspace/extra/state/l1/atlas_l1_central_bank.json.tmp \
   /workspace/extra/state/l1/atlas_l1_central_bank.json
```

The `ready.json` sentinel must ALWAYS be the last file written — after all data files are flushed and atomically moved.

Include this instruction in every agent's CLAUDE.md.

### 2.3 Recommendation Direction Contract

All agents across L1–L4 must use only these directions in their recommendation records and state files:
- `LONG` — initiate or maintain a long position (new buy)
- `SHORT` — initiate or maintain a short position (new sell-short)
- `EXIT` — close an existing position entirely (sell if long, cover if short)

Do NOT use `ADD`, `REDUCE`, `HOLD`, or `BUY`/`SELL` in agent recommendations. The CIO translates recommendations into `portfolio_actions.json` using order verbs (`BUY`/`SELL`/`HOLD`) — see CIO output schema.

The scorecard scores `LONG` as a bet on price appreciation and `SHORT` as a bet on decline. `EXIT` recommendations are not scored.

### 2.4 Execution Order Contract

The CIO outputs **delta orders** (not target portfolio state). Each action in `portfolio_actions.json` specifies:
- `action`: `BUY` | `SELL` | `HOLD`
- `intent`: `open_long` | `close_long` | `open_short` | `close_short` — disambiguates SELL semantics
- `side`: `buy` | `sell` — the Alpaca API `side` field, directly usable in the order submission
- `shares`: number of shares to trade
- `limit_price`: limit price for the order (note: `limit_price`, not `price_limit`)

**v1 is long-only.** Short selling is deferred to v2 due to borrow availability, margin, and close-vs-open ambiguity. The CIO should not generate `SHORT` actions or `open_short`/`close_short` intents. If an L3 agent recommends `SHORT`, the CIO skips it with a note in `risk_commentary`.

### 2.5 Forward Return and Scoring Contract

The Darwinian scoring system uses **5 trading day forward returns** as the primary evaluation metric.

- "5 trading days" = skip weekends and NYSE holidays. Use 7 calendar days as a v1 approximation.
- Each recommendation generates exactly ONE fill record after the 5-day window elapses.
- Fill record schema: `{"type":"fill","original_date":"...","ticker":"...","direction":"...","entry_price":...,"exit_price":...,"forward_return_5d":0.023,"eval_date":"..."}`
- `entry_price` = FMP closing price on the recommendation date (hypothetical, not actual fill)
- `exit_price` = FMP closing price on the evaluation date
- Sharpe formula: `mean(weighted_returns) / std(weighted_returns)` over the last 60 fill records
- `weighted_return = forward_return_5d * (conviction / 100)` — if direction is `SHORT`, multiply by `-1`
- Sharpe is raw (not annualized). For Darwinian ranking, annualization doesn't affect ordering.

**Scoring is per-layer.** L1, L2, L3, and L4 agents are scored in separate pools:
- L1 weights: compared only against other L1 agents
- L2 weights: compared only against other L2 agents (excluding relationship_mapper)
- L3 weights: compared only against other L3 agents
- L4: only `atlas_l4_alpha_discovery` is scored (CIO, CRO, AE are excluded)

This prevents apples-to-oranges comparisons between L1 proxy ETF regime calls and L3 stock picks.

---

## 3. Canonical Schemas

### 3.1 L1 Output Schema

Every L1 agent writes this exact schema to `data/state/l1/atlas_l1_{name}.json`:

```json
{
  "agent": "atlas_l1_{name}",
  "date": "2026-03-16",
  "regime": "RISK_ON | RISK_ON_LEAN | NEUTRAL | RISK_OFF_LEAN | RISK_OFF",
  "regime_conviction": 55,
  "proxy_etf": "XLF",
  "proxy_direction": "LONG",
  "key_signals": {},
  "analysis_summary": "Brief human-readable summary of the regime call",
  "last_updated": "2026-03-16T10:00:30Z"
}
```

- `regime`: one of exactly five values (case-sensitive)
- `regime_conviction`: integer 0-100
- `proxy_etf`: the sector ETF this regime call implies (used for scorecard logging)
- `proxy_direction`: `LONG` or `SHORT` — the direction of the proxy ETF recommendation
- `key_signals`: agent-specific object (yield curve shape, VIX level, etc.) — not consumed by formula but provides context

### 3.2 L2 Sector Desk Output Schema

Every L2 sector desk writes this schema to `data/state/l2/atlas_l2_{sector}.json`:

```json
{
  "agent": "atlas_l2_{sector}",
  "date": "2026-03-16",
  "macro_score": 0.089,
  "sector_view": "OVERWEIGHT | NEUTRAL | UNDERWEIGHT",
  "sector_conviction": 72,
  "top_picks": [
    {"ticker": "NVDA", "direction": "LONG", "conviction": 85, "rationale": "..."}
  ],
  "last_updated": "2026-03-16T10:12:00Z"
}
```

### 3.3 L2 Relationship Mapper Output Schema

```json
{
  "agent": "atlas_l2_relationship_mapper",
  "date": "2026-03-16",
  "sector_rotation": {
    "direction": "RISK_ON | RISK_OFF | NEUTRAL",
    "from_sectors": ["XLU", "XLP"],
    "to_sectors": ["XLK", "XLI"],
    "confidence": 65
  },
  "cross_sector_signals": [
    {"signal": "AI capex benefiting semis + cloud", "affected_tickers": ["NVDA", "AMZN"], "direction": "POSITIVE | NEGATIVE"}
  ],
  "macro_disagreements": ["central_bank says NEUTRAL but volatility says RISK_ON"],
  "last_updated": "2026-03-16T10:13:00Z"
}
```

The relationship mapper is unscored (not in `darwinian_weights.json`). It does not log to the scorecard.

**5-day relative performance note:** The market fetcher only provides current-day sector ETF quotes, not 5-day history. The relationship mapper should use `sector_etfs.json` price changes as a single-day proxy and note this limitation. If FMP's historical endpoint is within API budget, the market fetcher may optionally fetch 5-day sector ETF history in a future iteration.

### 3.4 L3 Superinvestor Output Schema

```json
{
  "agent": "atlas_l3_{name}",
  "date": "2026-03-16",
  "portfolio_thesis": "Brief summary of the current investment thesis",
  "recommendations": [
    {"ticker": "NVDA", "direction": "LONG", "conviction": 78, "rationale": "..."},
    {"ticker": "XOM", "direction": "EXIT", "conviction": 60, "rationale": "..."}
  ],
  "existing_positions_reviewed": ["NVDA", "XOM", "JPM"],
  "last_updated": "2026-03-16T10:16:00Z"
}
```

### 3.5 L4 CRO Output Schema

```json
{
  "agent": "atlas_l4_cro",
  "date": "2026-03-16",
  "risk_regime": "LOW | MODERATE | HIGH | CRITICAL",
  "portfolio_risk_assessment": {
    "concentration_risk": "description",
    "sector_risk": "description",
    "drawdown_from_hwm": "-2.3%",
    "correlation_risk": "description"
  },
  "ticker_cautions": [
    {"ticker": "NVDA", "caution": "DO_NOT_ADD | REDUCED_CONVICTION | EXIT_IMMEDIATELY", "reason": "..."}
  ],
  "override_signals": [
    {"type": "REDUCE_GROSS", "target": 0.5, "reason": "Drawdown exceeds 15% threshold"}
  ],
  "last_updated": "2026-03-16T10:18:00Z"
}
```

CRO caution levels:
- `DO_NOT_ADD`: CIO should not increase this position
- `REDUCED_CONVICTION`: CIO applies ×0.7 multiplier
- `EXIT_IMMEDIATELY`: CIO generates SELL regardless of L3 views

### 3.6 L4 Alpha Discovery Output Schema

```json
{
  "agent": "atlas_l4_alpha_discovery",
  "date": "2026-03-16",
  "fresh_alpha": [
    {
      "ticker": "AMZN",
      "direction": "LONG",
      "conviction": 74,
      "source_agents": ["atlas_l2_consumer", "atlas_l3_ackman"],
      "rationale": "...",
      "weighted_score": 1.42
    }
  ],
  "last_updated": "2026-03-16T10:18:14Z"
}
```

**Important:** `direction` is required. If no fresh alpha is found, write `"fresh_alpha": []` (never skip writing the file).

### 3.7 CIO Output Schema (`portfolio_actions.json`)

```json
{
  "market_view": "string",
  "regime_summary": "aggregated L1 signal with weights",
  "actions": [
    {
      "ticker": "XOM",
      "action": "SELL",
      "intent": "close_long",
      "side": "sell",
      "shares": 120,
      "limit_price": 113.20,
      "rationale": "...",
      "conviction": 74
    },
    {
      "ticker": "AMZN",
      "action": "BUY",
      "intent": "open_long",
      "side": "buy",
      "shares": 18,
      "limit_price": 198.40,
      "rationale": "...",
      "conviction": 71
    }
  ],
  "portfolio_exposure": {"gross": 0.81, "net": 0.81, "cash_pct": 0.19},
  "risk_commentary": "...",
  "last_updated": "2026-03-16T10:20:00Z"
}
```

- `action`: `BUY` | `SELL` | `HOLD` — order verbs
- `intent`: `open_long` | `close_long` — disambiguates SELL (v1 long-only; `open_short` / `close_short` deferred to v2)
- `side`: `buy` | `sell` — directly maps to Alpaca API `side` parameter
- `limit_price`: limit price for the order. **Policy:** BUY: `quote_price × 1.02` (2% buffer above last close). SELL: `quote_price × 0.98` (2% buffer below).
- `portfolio_exposure`: projected exposure AFTER proposed actions execute (not current)

### 3.8 Recommendation Record Schema (JSONL)

```json
{"type": "recommendation", "date": "2026-03-16", "ticker": "XLF", "direction": "LONG", "conviction": 55, "entry_price": null, "rationale": "...", "recommendation_id": "atlas_l1_central_bank_2026-03-16_XLF_LONG"}
```

- `type`: `"recommendation"` — distinguishes from fill records
- `recommendation_id`: `{agent}_{date}_{ticker}_{direction}` — unique key for joining fill records
- `entry_price`: null at creation — filled by scorecard

### 3.9 Fill Record Schema (JSONL)

```json
{"type": "fill", "recommendation_id": "atlas_l1_central_bank_2026-03-16_XLF_LONG", "original_date": "2026-03-16", "ticker": "XLF", "direction": "LONG", "conviction": 55, "entry_price": 42.50, "exit_price": 43.20, "forward_return_5d": 0.0165, "eval_date": "2026-03-23"}
```

### 3.10 Order Submission Record Schema (JSONL)

```json
{"type": "submission", "date": "2026-03-16", "ticker": "XOM", "action": "SELL", "intent": "close_long", "side": "sell", "shares": 120, "order_type": "limit", "limit_price": 113.20, "order_id": "alpaca-order-id", "status": "submitted", "submitted_at": "2026-03-16T10:22:10Z"}
```

### 3.11 Order Update Record Schema (JSONL)

```json
{"type": "order_update", "order_id": "alpaca-order-id", "ticker": "XOM", "status": "filled", "filled_qty": 120, "filled_avg_price": 113.10, "updated_at": "2026-03-16T20:01:12Z"}
```

### 3.12 Positions Schema

```json
{
  "positions": [
    {
      "ticker": "NVDA",
      "shares": 40,
      "avg_cost": 880.00,
      "market_value": 42800.00,
      "unrealized_pnl": 7600.00
    }
  ],
  "cash": 30340.00,
  "portfolio_value": 99900.00,
  "last_updated": "2026-03-16T10:00:41Z",
  "source": "alpaca"
}
```

Never computed by agents — always pulled from Alpaca broker API.

### 3.13 High-Water Mark Schema

```json
{
  "high_water_mark": 96200.00,
  "hwm_date": "2026-03-10",
  "last_updated": "2026-03-16T22:00:00Z"
}
```

Maintained by the scorecard agent at `data/portfolio/hwm.json`. Updated if `portfolio_value > high_water_mark`. Read by CRO and CIO for drawdown calculation.

---

## 4. Repository Layout

```
bread-baker/
├── nanoclaw/                         ← NanoClaw fork (modify freely)
│   ├── src/                          ← modify freely as needed
│   ├── container/
│   │   └── Dockerfile                ← ADD: python3-numpy, jq
│   ├── groups/
│   │   ├── main/CLAUDE.md            ← existing, update to know about ATLAS
│   │   ├── global/CLAUDE.md          ← existing
│   │   │
│   │   ├── atlas_market_fetcher/CLAUDE.md
│   │   ├── atlas_scorecard/CLAUDE.md
│   │   ├── atlas_autoresearch/CLAUDE.md
│   │   ├── atlas_autoresearch_evaluator/CLAUDE.md
│   │   ├── atlas_pipeline_watchdog/CLAUDE.md
│   │   │
│   │   ├── atlas_l1_central_bank/CLAUDE.md
│   │   ├── atlas_l1_geopolitical/CLAUDE.md
│   │   ├── atlas_l1_china/CLAUDE.md
│   │   ├── atlas_l1_dollar/CLAUDE.md
│   │   ├── atlas_l1_yield_curve/CLAUDE.md
│   │   ├── atlas_l1_commodities/CLAUDE.md
│   │   ├── atlas_l1_volatility/CLAUDE.md
│   │   ├── atlas_l1_emerging_markets/CLAUDE.md
│   │   ├── atlas_l1_news_sentiment/CLAUDE.md
│   │   ├── atlas_l1_institutional_flow/CLAUDE.md
│   │   │
│   │   ├── atlas_l2_semiconductor/CLAUDE.md
│   │   ├── atlas_l2_energy/CLAUDE.md
│   │   ├── atlas_l2_biotech/CLAUDE.md
│   │   ├── atlas_l2_consumer/CLAUDE.md
│   │   ├── atlas_l2_industrials/CLAUDE.md
│   │   ├── atlas_l2_financials/CLAUDE.md
│   │   ├── atlas_l2_relationship_mapper/CLAUDE.md
│   │   │
│   │   ├── atlas_l3_druckenmiller/CLAUDE.md
│   │   ├── atlas_l3_aschenbrenner/CLAUDE.md
│   │   ├── atlas_l3_baker/CLAUDE.md
│   │   ├── atlas_l3_ackman/CLAUDE.md
│   │   │
│   │   ├── atlas_l4_cro/CLAUDE.md
│   │   ├── atlas_l4_alpha_discovery/CLAUDE.md
│   │   ├── atlas_l4_autonomous_execution/CLAUDE.md
│   │   └── atlas_l4_cio/CLAUDE.md
│   │
│   ├── scripts/
│   │   ├── register-atlas-groups.ts  ← bootstrap all groups into SQLite
│   │   └── scorecard_math.py         ← deterministic Sharpe/weight calculation
│   │
│   └── store/
│       └── messages.db
│
└── data/                             ← host-side shared state
    ├── state/
    │   ├── l1/                       ← 10 individual L1 agent files
    │   ├── l2/                       ← 7 individual L2 agent files
    │   ├── l3/                       ← 4 individual L3 agent files
    │   └── l4/
    │       ├── atlas_l4_cro.json
    │       ├── atlas_l4_alpha_discovery.json
    │       └── portfolio_actions.json
    ├── market/
    │   ├── ready.json                ← fixed-path scheduler signal
    │   └── {date}/                   ← daily snapshot folder
    │       ├── equity_quotes.json
    │       ├── sector_etfs.json
    │       ├── yield_curve.json
    │       ├── vix.json
    │       ├── dxy.json
    │       ├── macro_indicators.json
    │       ├── news_sentiment.json
    │       └── ready.json            ← dated idempotency sentinel
    ├── scorecard/
    │   ├── recommendations/
    │   │   └── {agent_folder}.jsonl
    │   ├── agent_scores.json
    │   ├── darwinian_weights.json
    │   └── autoresearch_log.jsonl    ← JSONL, not markdown
    └── portfolio/
        ├── positions.json
        ├── orders_log.jsonl
        └── hwm.json                  ← high-water mark
```

---

## 5. Friction Areas (Resolved)

### Friction 1: Non-Main Groups Cannot Write to Shared Mounts

**Decision:** Set `nonMainReadOnly: false` in the mount allowlist. Scope `allowedRoots` narrowly.

```json
{
  "allowedRoots": [
    {
      "path": "~/Documents/dev/bread-baker/data",
      "allowReadWrite": true,
      "description": "ATLAS shared data directory"
    },
    {
      "path": "~/Documents/dev/bread-baker/nanoclaw/groups",
      "allowReadWrite": true,
      "description": "Agent group folders — autoresearch writes CLAUDE.md"
    },
    {
      "path": "~/Documents/dev/bread-baker/nanoclaw",
      "allowReadWrite": true,
      "description": "Full nanoclaw repo — autoresearch needs git access"
    },
    {
      "path": "~/.config/bread-baker",
      "allowReadWrite": false,
      "description": "API keys — read-only for market fetcher and autonomous execution"
    }
  ],
  "blockedPatterns": ["credentials", "secret", "token", "password"],
  "nonMainReadOnly": false
}
```

### Friction 2: MAX_CONCURRENT_CONTAINERS

**Decision:** `MAX_CONCURRENT_CONTAINERS=30` in `.env`.

### Friction 3: Batch Agents Need a `chat_jid`

**Decision:** Create `#atlas-output` Discord channel. All ATLAS tasks use its JID. CIO sends formatted summary there; all other agents wrap output in `<internal>` tags.

### Friction 4: Layer Ordering — Dependency-Gated Scheduling (REDESIGNED)

**Problem:** The v1 scheduler patch was too minimal. Tasks with unmet dependencies could stall forever, retry infinitely, or accumulate zombie entries.

**Solution: Extend `src/scheduler.ts` with a proper task run-state model.**

#### Schema changes — `src/db.ts`:

```sql
-- Add to scheduled_tasks:
depends_on_signals TEXT DEFAULT NULL,       -- JSON array of absolute file paths
depends_on_deadline TEXT DEFAULT NULL        -- e.g., "09:00" — NY time; give up after this

-- Add run tracking table:
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  trading_date TEXT NOT NULL,               -- UTC YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | waiting_dependencies | running | succeeded | failed | deadline_expired
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  UNIQUE(task_id, trading_date)             -- one run per task per day
);
```

#### Scheduler logic — `src/scheduler.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';

function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.resolve(p);
}

function dependenciesMet(task: ScheduledTask, today: string): boolean {
  if (!task.depends_on_signals) return true;
  const signals: string[] = JSON.parse(task.depends_on_signals);
  return signals.every(filePath => {
    try {
      const data = JSON.parse(fs.readFileSync(expandHome(filePath), 'utf8'));
      return data.last_updated?.startsWith(today);
    } catch {
      return false;
    }
  });
}

function pastDeadline(task: ScheduledTask): boolean {
  if (!task.depends_on_deadline) return false;
  const now = new Date();
  const [h, m] = task.depends_on_deadline.split(':').map(Number);
  // Convert deadline from NY time to UTC for comparison
  const nyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false
  });
  const nyParts = nyFormatter.formatToParts(now);
  const nyHour = parseInt(nyParts.find(p => p.type === 'hour')!.value);
  const nyMin = parseInt(nyParts.find(p => p.type === 'minute')!.value);
  return (nyHour > h) || (nyHour === h && nyMin >= m);
}

// Task state transitions per scheduler tick:
//
// | Scenario                                    | Action                                           |
// |---------------------------------------------|--------------------------------------------------|
// | next_run passed, dependencies met            | Fire task, create run record (status=running)    |
// | next_run passed, dependencies NOT met        | Don't fire, don't advance — recheck next tick    |
// | next_run passed, deps not met, past deadline | Mark run failed, advance next_run, send alert    |
// | Task completed successfully                  | Update run (status=succeeded), advance next_run  |
// | Task failed or timed out                     | Update run (status=failed), advance next_run     |

const today = new Date().toISOString().split('T')[0];
const readyTasks = candidateTasks.filter(task => {
  if (dependenciesMet(task, today)) {
    return true;
  }
  if (pastDeadline(task)) {
    markTaskDeadlineExpired(task, today);
    advanceNextRun(task);
    sendAlert(task.chat_jid,
      `⚠️ ${task.group_folder} skipped — upstream dependencies not met by ${task.depends_on_deadline}`);
    return false;
  }
  return false; // wait for next tick
});
```

**Container timeout:** All ATLAS agents use `timeout: 600000` (10 minutes). A timed-out agent does not write its signal file, which blocks downstream layers cleanly. After timeout, `next_run` is advanced to prevent retry loops.

**Pipeline dependency map:**

| Agent | Cron (NY) | depends_on_signals | depends_on_deadline |
|-------|-----------|--------------------|--------------------|
| market_fetcher | `0 6 * * 1-5` | *(none)* | — |
| L1 × 10 | `0 6 * * 1-5` | `[market/ready.json]` | `09:00` |
| L2 × 7 | `0 6 * * 1-5` | `[state/l1/*.json × 10]` | `09:00` |
| L3 × 4 | `0 6 * * 1-5` | `[state/l2/*.json × 7]` | `09:15` |
| L4 CRO | `0 6 * * 1-5` | `[state/l3/*.json × 4]` | `09:15` |
| L4 Alpha Discovery | `0 6 * * 1-5` | `[state/l3/*.json × 4]` | `09:15` |
| L4 CIO | `0 6 * * 1-5` | `[cro.json, alpha_discovery.json]` | `09:25` |
| Autonomous Execution | `0 6 * * 1-5` | `[portfolio_actions.json]` | `09:25` |
| Pipeline Watchdog | `30 9 * * 1-5` | *(none)* | — |
| Scorecard | `0 18 * * 1-5` | *(none)* | — |
| Autoresearch | `0 20 * * 1-5` | *(none)* | — |
| Autoresearch Evaluator | `30 20 * * 1` | *(none)* | — |

**Scheduler poll interval:** `SCHEDULER_POLL_INTERVAL=15000` (15 seconds). Make configurable in `src/config.ts`:
```typescript
export const SCHEDULER_POLL_INTERVAL = parseInt(
  process.env.SCHEDULER_POLL_INTERVAL || '60000', 10
);
```

### Friction 5: Autoresearch (REDESIGNED — No Branches)

**Problem (v1):** The autoresearch agent created git branches to test prompt changes. This was fundamentally broken because:
1. NanoClaw mounts the host working tree — changing the branch changes what all agents see
2. The next autoresearch run checks out `main`, reverting the previous experiment after only 1 day
3. The evaluator's `git revert` targets `main` but the commit is on a branch
4. Multiple concurrent experiments overwrite each other

**Solution:** Commit directly to `main`. No branches. The evaluator reverts by SHA if the change didn't help.

See Section 7.7 (`atlas_autoresearch/CLAUDE.md`) and Section 7.8 (`atlas_autoresearch_evaluator/CLAUDE.md`) for the redesigned workflow.

### Friction 6: Positions — Broker as Source of Truth

**Decision:** Unchanged from v1. Three sync points:
1. Market fetcher (06:00) — pre-pipeline snapshot
2. Autonomous Execution (post-trade) — immediate re-pull
3. Scorecard (18:00) — EOD settled state

**Broker: Alpaca.** Paper: `https://paper-api.alpaca.markets`. Live: `https://api.alpaca.markets`. Switch by changing `ALPACA_BASE_URL` in `api-keys.json`.

**`api-keys.json` schema:**
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

---

## 6. Market Holiday Handling

The market fetcher checks market status FIRST, before fetching any data:

```bash
CLOCK=$(curl -s "$ALPACA_BASE_URL/v2/clock" \
  -H "APCA-API-KEY-ID: $ALPACA_KEY" \
  -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")
IS_OPEN=$(echo "$CLOCK" | jq -r '.is_open')
NEXT_OPEN=$(echo "$CLOCK" | jq -r '.next_open')

TODAY=$(date -u +%Y-%m-%d)
NEXT_OPEN_DATE=$(echo "$NEXT_OPEN" | cut -dT -f1)

# If market is closed AND next_open is not today → holiday/weekend
if [ "$IS_OPEN" = "false" ] && [ "$NEXT_OPEN_DATE" != "$TODAY" ]; then
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "{\"last_updated\":\"$NOW\",\"date\":\"$TODAY\",\"holiday\":true}" \
    > /workspace/extra/market/ready.json.tmp
  mv /workspace/extra/market/ready.json.tmp /workspace/extra/market/ready.json
  exit 0
fi
```

**L1 agents check for the holiday flag** at startup:

```bash
HOLIDAY=$(cat /workspace/extra/market/ready.json | jq -r '.holiday // false')
if [ "$HOLIDAY" = "true" ]; then
  echo "<internal>Market holiday — no analysis today.</internal>"
  # Write a holiday-flagged state file so downstream agents can detect the holiday
  echo "{\"agent\":\"$AGENT_NAME\",\"date\":\"$TODAY\",\"holiday\":true,\"last_updated\":\"$NOW\"}" \
    > /workspace/extra/state/l1/${AGENT_NAME}.json.tmp
  mv /workspace/extra/state/l1/${AGENT_NAME}.json.tmp \
     /workspace/extra/state/l1/${AGENT_NAME}.json
  exit 0
fi
```

**Downstream propagation:** Each layer checks if its inputs have `"holiday": true`. If all inputs are holiday-flagged, the agent writes its own holiday-flagged output and exits. This propagates the holiday signal cleanly through the entire pipeline. Autonomous Execution sees holiday-flagged files, skips trading, and does NOT alert (this is expected, not a failure).

---

## 7. Files to Create (Prioritized Order)

### Phase 1: Infrastructure Foundation

#### 7.0 Scheduler Extension — `src/db.ts`, `src/scheduler.ts`, `src/config.ts`

Add `depends_on_signals TEXT DEFAULT NULL` and `depends_on_deadline TEXT DEFAULT NULL` to `scheduled_tasks`.

**SQLite migration path:** Since `messages.db` may already exist, use `ALTER TABLE` with error handling:

```typescript
try {
  db.exec("ALTER TABLE scheduled_tasks ADD COLUMN depends_on_signals TEXT DEFAULT NULL");
} catch (e) {
  // Column already exists — safe to ignore
}
try {
  db.exec("ALTER TABLE scheduled_tasks ADD COLUMN depends_on_deadline TEXT DEFAULT NULL");
} catch (e) {
  // Column already exists
}
```

Create the `task_runs` table (see Section 5, Friction 4).

Add the `dependenciesMet()`, `pastDeadline()` checks and the state transition logic to the scheduler's ready-task filter.

Add `import os from 'os'` and `import path from 'path'` alongside existing imports.

After changes: `cd nanoclaw && npm run build && launchctl kickstart -k gui/$(id -u)/com.bread-baker`

#### 7.1 Mount Allowlist

Create on host at `~/.config/bread-baker/mount-allowlist.json` (see Friction 1).

#### 7.2 Data Directory Scaffolding

```bash
mkdir -p ~/Documents/dev/bread-baker/data/{state/l1,state/l2,state/l3,state/l4,market,scorecard/recommendations,portfolio}
```

Initialize `darwinian_weights.json` — **per-layer pools** (agents only compared within their layer):

```json
{
  "atlas_l1_central_bank": 1.0,
  "atlas_l1_geopolitical": 1.0,
  "atlas_l1_china": 1.0,
  "atlas_l1_dollar": 1.0,
  "atlas_l1_yield_curve": 1.0,
  "atlas_l1_commodities": 1.0,
  "atlas_l1_volatility": 1.0,
  "atlas_l1_emerging_markets": 1.0,
  "atlas_l1_news_sentiment": 1.0,
  "atlas_l1_institutional_flow": 1.0,
  "atlas_l2_semiconductor": 1.0,
  "atlas_l2_energy": 1.0,
  "atlas_l2_biotech": 1.0,
  "atlas_l2_consumer": 1.0,
  "atlas_l2_industrials": 1.0,
  "atlas_l2_financials": 1.0,
  "atlas_l3_druckenmiller": 1.0,
  "atlas_l3_aschenbrenner": 1.0,
  "atlas_l3_baker": 1.0,
  "atlas_l3_ackman": 1.0,
  "atlas_l4_alpha_discovery": 1.0
}
```

**Excluded from scoring:** `atlas_l2_relationship_mapper` (structural insights), `atlas_l4_cro` (risk assessments), `atlas_l4_autonomous_execution` (execution), `atlas_l4_cio` (self-referential loop — CIO reads weights that include its own weight).

Initialize `agent_scores.json` as `{}`.
Initialize `hwm.json` as `{"high_water_mark": 0, "hwm_date": null, "last_updated": null}`.
Touch `orders_log.jsonl`.
Initialize `autoresearch_log.jsonl` as empty file.

#### 7.3 `.env` and `src/config.ts`

Append to `.env`:
```
MAX_CONCURRENT_CONTAINERS=30
SCHEDULER_POLL_INTERVAL=15000
```

In `src/config.ts`, make poll interval env-configurable.

#### 7.4 Dockerfile

Add `numpy` and `jq` to the container:
```dockerfile
RUN pip3 install numpy --quiet
RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*
```

Also configure git identity for autoresearch containers:
```dockerfile
RUN git config --global user.name "ATLAS Autoresearch" && \
    git config --global user.email "autoresearch@atlas.local"
```

Rebuild: `cd nanoclaw && ./container/build.sh`

#### 7.5 Deterministic Scorecard Script — `nanoclaw/scripts/scorecard_math.py`

The scorecard's math (Sharpe calculation, Darwinian weight update) must be deterministic — not generated by an LLM on the fly. Create a static Python script:

```python
#!/usr/bin/env python3
"""
Deterministic scorecard math for ATLAS-GIC.
Usage: python3 scorecard_math.py <recommendations_dir> <agent_scores_path> <darwinian_weights_path>

Reads all JSONL files in recommendations_dir.
Computes rolling 60-record Sharpe per agent.
Updates agent_scores.json and darwinian_weights.json.
"""
import json
import sys
import os
import numpy as np
from collections import defaultdict

LAYER_POOLS = {
    'l1': [
        'atlas_l1_central_bank', 'atlas_l1_geopolitical', 'atlas_l1_china',
        'atlas_l1_dollar', 'atlas_l1_yield_curve', 'atlas_l1_commodities',
        'atlas_l1_volatility', 'atlas_l1_emerging_markets', 'atlas_l1_news_sentiment',
        'atlas_l1_institutional_flow',
    ],
    'l2': [
        'atlas_l2_semiconductor', 'atlas_l2_energy', 'atlas_l2_biotech',
        'atlas_l2_consumer', 'atlas_l2_industrials', 'atlas_l2_financials',
    ],
    'l3': [
        'atlas_l3_druckenmiller', 'atlas_l3_aschenbrenner',
        'atlas_l3_baker', 'atlas_l3_ackman',
    ],
    'l4': ['atlas_l4_alpha_discovery'],
}

MIN_RETURNS_FOR_ACTIVE = 20
MIN_ACTIVE_AGENTS_FOR_WEIGHT_UPDATE = 3  # per layer pool
WEIGHT_BOOST = 1.05
WEIGHT_DECAY = 0.95
WEIGHT_CAP = 2.5
WEIGHT_FLOOR = 0.3

def compute_sharpe(returns):
    if len(returns) < MIN_RETURNS_FOR_ACTIVE:
        return None
    arr = np.array(returns[-60:])
    std = np.std(arr)
    if std == 0:
        return 0.0
    return float(np.mean(arr) / std)

def main():
    rec_dir = sys.argv[1]
    scores_path = sys.argv[2]
    weights_path = sys.argv[3]

    # Load existing weights
    with open(weights_path) as f:
        weights = json.load(f)

    agent_returns = defaultdict(list)

    # Read all JSONL files
    for fname in os.listdir(rec_dir):
        if not fname.endswith('.jsonl'):
            continue
        agent = fname.replace('.jsonl', '')
        filepath = os.path.join(rec_dir, fname)
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                if rec.get('type') == 'fill' and 'forward_return_5d' in rec:
                    wr = rec['forward_return_5d'] * (rec.get('conviction', 50) / 100)
                    if rec.get('direction') == 'SHORT':
                        wr *= -1
                    agent_returns[agent].append(wr)

    # Compute scores
    scores = {}
    for agent, returns in agent_returns.items():
        sharpe = compute_sharpe(returns)
        win_rate = sum(1 for r in returns if r > 0) / len(returns) if returns else 0
        avg_conv = 50  # placeholder
        scores[agent] = {
            'sharpe_60d': sharpe,
            'returns_count': len(returns),
            'avg_conviction': avg_conv,
            'win_rate': round(win_rate, 3),
            'status': 'active' if sharpe is not None else 'insufficient_data',
        }

    # Write scores
    with open(scores_path, 'w') as f:
        json.dump(scores, f, indent=2)

    # Update weights per layer pool
    for layer, agents in LAYER_POOLS.items():
        active = {a: scores[a] for a in agents if a in scores and scores[a]['status'] == 'active'}
        if len(active) < MIN_ACTIVE_AGENTS_FOR_WEIGHT_UPDATE:
            continue
        sharpes = sorted(active.items(), key=lambda x: x[1]['sharpe_60d'] or 0)
        n = len(sharpes)
        top_cutoff = int(n * 0.75)
        bottom_cutoff = int(n * 0.25)
        for i, (agent, _) in enumerate(sharpes):
            if agent not in weights:
                weights[agent] = 1.0
            if i < bottom_cutoff:
                weights[agent] = max(WEIGHT_FLOOR, weights[agent] * WEIGHT_DECAY)
            elif i >= top_cutoff:
                weights[agent] = min(WEIGHT_CAP, weights[agent] * WEIGHT_BOOST)

    with open(weights_path, 'w') as f:
        json.dump(weights, f, indent=2)

    print(json.dumps({'agents_scored': len(scores), 'weights_updated': True}))

if __name__ == '__main__':
    main()
```

The scorecard agent invokes this script rather than writing Python on the fly:
```bash
python3 /workspace/extra/repo/scripts/scorecard_math.py \
  /workspace/extra/scorecard/recommendations \
  /workspace/extra/scorecard/agent_scores.json \
  /workspace/extra/scorecard/darwinian_weights.json
```

#### 7.6 API Keys

Create `~/.config/bread-baker/api-keys.json` (see Friction 6 for schema).

---

### Phase 2: Group Folders and CLAUDE.md Files

#### Standard CLAUDE.md Template (all ATLAS agents)

```markdown
# [Agent Name]

## Role
[From ATLAS spec — agent's mandate and philosophy]

## Container Paths
- Market data: `/workspace/extra/market/` (read-only)
- Shared state (read): `/workspace/extra/state/`
- Shared state (write): `/workspace/extra/state/[layer]/[this_agent].json`
- Scorecard: `/workspace/extra/scorecard/`
- API keys: `/workspace/extra/api-keys/api-keys.json`
- Agent memory: `/workspace/group/` (persistent across runs)

## Date and Time
Always use UTC for dates and timestamps:
- Today's date: `date -u +%Y-%m-%d`
- Current timestamp: `date -u +%Y-%m-%dT%H:%M:%SZ`

## Atomic Writes
When writing any JSON output file, write to a temporary file first, then move atomically:
```
echo '...' > /workspace/extra/state/l1/atlas_l1_example.json.tmp
mv /workspace/extra/state/l1/atlas_l1_example.json.tmp \
   /workspace/extra/state/l1/atlas_l1_example.json
```

## Data Sources
[Specific files to read — listed explicitly per agent]

## Analysis Framework
[Agent-specific reasoning steps]

## Output
Write JSON to `/workspace/extra/state/[layer]/[filename].json` using the canonical schema.
Include `last_updated` with UTC ISO timestamp.

After writing state, append a recommendation record to
`/workspace/extra/scorecard/recommendations/[group_folder].jsonl`:
```json
{"type":"recommendation","date":"2026-03-16","ticker":"XLF","direction":"LONG","conviction":55,"entry_price":null,"rationale":"...","recommendation_id":"atlas_l1_central_bank_2026-03-16_XLF_LONG"}
```

## Startup Check
Verify required input files exist and have `last_updated` matching today's UTC date.
Also check for `"holiday": true` — if all inputs are holiday-flagged, write a holiday-flagged
output and exit cleanly.
If inputs are not ready: `<internal>Input not ready. Exiting.</internal>` and exit.

## Memory
Use `/workspace/group/memory.md` to persist key observations across sessions.
If it does not exist, create it with: `# Agent Memory\n\n## Observations\n`

## Output Formatting
Wrap all analysis in `<internal>` tags. Only send user-visible output if you have a notable alert.
Keep Discord messages under 2000 characters.
```

#### L1 Agent Data Source Mapping

| L1 Agent | Primary Data Files | Secondary | Proxy ETF |
|----------|-------------------|-----------|-----------|
| `central_bank` | `yield_curve.json`, `macro_indicators.json` | `dxy.json` | XLF |
| `geopolitical` | `news_sentiment.json`, `dxy.json`, `macro_indicators.json` | `vix.json` | SPY |
| `china` | `equity_quotes.json` (FXI), `dxy.json` | `news_sentiment.json` | FXI |
| `dollar` | `dxy.json`, `equity_quotes.json` (EEM, GLD) | `macro_indicators.json` | EEM |
| `yield_curve` | `yield_curve.json` | `macro_indicators.json` | TLT |
| `commodities` | `equity_quotes.json` (GLD, USO), `dxy.json` | `news_sentiment.json` | GLD |
| `volatility` | `vix.json`, `equity_quotes.json` (SPY) | — | SPY |
| `emerging_markets` | `equity_quotes.json` (EEM, FXI), `dxy.json` | `news_sentiment.json` | EEM |
| `news_sentiment` | `news_sentiment.json` | `equity_quotes.json` (SPY) | SPY |
| `institutional_flow` | `equity_quotes.json` (volume data), `sector_etfs.json` | `news_sentiment.json` | XLK |

**`institutional_flow` data note:** Finnhub institutional ownership data updates quarterly (13F filings), not daily. This agent uses daily volume anomalies from `equity_quotes.json` and sector ETF relative volume from `sector_etfs.json` as proxies for institutional activity. Its CLAUDE.md must note: "Direct institutional flow data is not available daily. Infer positioning from volume anomalies in large-cap stocks and sector ETF flows."

**L1 agents do NOT have a startup dependency check** — they are the first layer, gated by the scheduler's dependency on `market/ready.json`. They do check the holiday flag.

#### L2 Aggregation Formula

L2 agents read all 10 L1 state files and compute a weighted macro regime score:

```python
regime_scores = {"RISK_ON": 1.0, "RISK_ON_LEAN": 0.5, "NEUTRAL": 0.0, "RISK_OFF_LEAN": -0.5, "RISK_OFF": -1.0}

weighted_sum = 0
weight_total = 0
for l1_file in l1_state_files:
    agent_name = l1_file["agent"]
    regime = l1_file["regime"]
    conviction = l1_file.get("regime_conviction", 50) / 100
    darwinian_weight = darwinian_weights.get(agent_name, 1.0)

    weighted_sum += regime_scores[regime] * conviction * darwinian_weight
    weight_total += darwinian_weight

macro_score = weighted_sum / weight_total  # range [-1, 1]
```

L2 agents use `macro_score` to calibrate sector conviction: strongly negative (< -0.5) dampens bullish calls; strongly positive (> 0.5) amplifies them.

#### L3 Agent Philosophies

**Druckenmiller:** Macro-driven momentum. Follow the dominant trend, concentrate in benefiting sectors. Cut losses aggressively when thesis breaks. Use `LONG`, `SHORT`, `EXIT`.

**Aschenbrenner:** AI/compute secular thesis. Semiconductors, cloud, data center power. Long-dated conviction. Use macro as risk guardrails, not primary drivers.

**Baker:** Structural imbalance detection. Contrarian. Fade crowded trades. Skeptical of consensus. **REGIME FILTER (v2 addition):** When L1 weighted macro_score > 0.3, reduce SHORT conviction by 20 points and require minimum conviction 65 for any SHORT position.

**Ackman:** Concentrated value with catalyst. 5-8 positions max. Deep fundamental analysis. Respect CRO concentration flags.

**L3 agents MAY read L1 outputs directly** from `/workspace/extra/state/l1/` for additional macro context (L1 files are guaranteed to exist when L3 runs).

#### CIO Decision Rules (v2 addition)

The CIO must implement explicit go/no-go rules:

```
DECISION RULES:
1. New LONG position requires: ≥2 source agents (L3 + Alpha Discovery combined)
   with weighted average conviction ≥ 55 after regime adjustment.
2. EXIT an existing position: any single L3 agent with conviction ≥ 50 OR CRO EXIT_IMMEDIATELY.
3. Alpha Discovery candidates count as 1 additional "vote" with their listed conviction.
4. When L3 agents conflict on the same ticker: net out by weighted conviction.
   If net < 30, skip the ticker entirely.
5. SHORT positions are deferred to v2 — skip all SHORT recommendations.
```

**CIO position sizing:**
```
shares = floor(portfolio_value * position_size_pct * conviction_weight / current_price)
position_size_pct = min(0.15, 0.05 * darwinian_weight)
conviction_weight = conviction / 100
```

**CIO risk rules:**
- Max single-position size: 15% of portfolio
- Max sector concentration: 30% of portfolio
- Conviction floor by regime: RISK_OFF ≥ 70, NEUTRAL ≥ 50, RISK_ON ≥ 40
- If net drawdown > 15% from HWM (read from `data/portfolio/hwm.json`): reduce gross exposure by 50%
- Stop-loss: any position down > 20% from entry: flag for EXIT
- Cash floor: maintain minimum 10% cash

**CIO limit price policy:**
- Price source: `equity_quotes.json` (previous close / most recent available)
- BUY: `limit_price = quote_price × 1.02`
- SELL: `limit_price = quote_price × 0.98`

**CIO does NOT log to the scorecard.** It is excluded from `darwinian_weights.json`.

**CIO reads L1 state files directly** (in addition to L3/CRO/Alpha Discovery) for the `regime_summary` field. Add L1 state mounts to CIO's container config.

---

### 7.7 `atlas_autoresearch/CLAUDE.md` (REDESIGNED)

```
You are the ATLAS autoresearch orchestrator. Every weekday at 20:00 you run exactly once.

Your job:
1. Read /workspace/extra/scorecard/agent_scores.json
2. Minimum data guard: Skip any agent with status "insufficient_data" or returns_count < 20.
   If ALL scored agents have < 20 returns, log "Insufficient data — skipping" and exit.
3. Find the agent with the lowest rolling Sharpe among eligible agents.
   Skip any agent modified by autoresearch less than 7 calendar days ago:
   Check: git -C /workspace/extra/repo log --format="%H %ai" --grep="autoresearch:" -- groups/{folder}/CLAUDE.md | head -1
   If the most recent autoresearch commit is < 7 days old, skip this agent and try the next lowest.
4. Read that agent's CLAUDE.md from /workspace/extra/groups/{folder}/CLAUDE.md
5. Read its last 20 recommendation records from /workspace/extra/scorecard/recommendations/{folder}.jsonl
6. Identify ONE specific failure pattern (e.g., always bullish in sector weakness, no momentum filter)
7. Propose ONE surgical change (1-3 sentences added or modified). Do not change core identity or data sources.
8. Ensure you are on main:
   git -C /workspace/extra/repo checkout main
9. Apply the change to /workspace/extra/groups/{folder}/CLAUDE.md
10. Commit directly to main:
    git -C /workspace/extra/repo add groups/{folder}/CLAUDE.md
    git -C /workspace/extra/repo commit -m "autoresearch: {short-description} for {agent}"
11. Record the commit SHA:
    COMMIT_SHA=$(git -C /workspace/extra/repo rev-parse HEAD)
12. Log to /workspace/extra/scorecard/autoresearch_log.jsonl (append one JSON line):
    {"date":"2026-03-16","agent":"{folder}","commit_sha":"$COMMIT_SHA","old_sharpe":-0.15,"rationale":"...","status":"pending"}
13. This agent does NOT evaluate or revert. The evaluator handles that.

IMPORTANT: Do NOT create branches. Commit directly to main.
Wrap all output in <internal> tags.
```

### 7.8 `atlas_autoresearch_evaluator/CLAUDE.md` (REDESIGNED)

```
You are the ATLAS autoresearch evaluator. You run every Monday at 20:30.

1. Read /workspace/extra/scorecard/autoresearch_log.jsonl
2. Find all entries where status = "pending" and date <= 7 calendar days ago
3. For each pending entry (process ONE at a time):
   a. Read agent_scores.json — get the agent's current Sharpe
   b. Compare to old_sharpe from the log entry
   c. EVALUATION METHOD: Compare the agent's average weighted return over the
      7 days AFTER the commit vs the 7 days BEFORE the commit. Read the agent's
      JSONL fill records and partition by date relative to the commit date.
      If post-change average return > pre-change average return: IMPROVED.
      If 7-day post-change Sharpe improved by >= 0.05 over 7-day pre-change Sharpe: also IMPROVED.
   d. If IMPROVED:
      - Update log entry status to "merged" (change is already on main, nothing to do)
      - Log: "KEPT {commit_sha}: {agent} improved"
   e. If NOT IMPROVED:
      - Revert the commit:
        git -C /workspace/extra/repo revert --no-edit {commit_sha}
      - Update log entry status to "reverted"
      - Log: "REVERTED {commit_sha}: {agent} did not improve"
   f. If git revert fails (conflict with subsequent changes):
      - Update status to "conflict"
      - Log: "CONFLICT {commit_sha}: manual resolution required"
      - Do NOT attempt automatic conflict resolution
4. Write updated entries back to autoresearch_log.jsonl
   (read all lines, update matching entries, write all lines back)

Wrap all output in <internal> tags.
```

### 7.9 `atlas_market_fetcher/CLAUDE.md`

Runs at 06:00. Steps:

1. Read API keys from `/workspace/extra/api-keys/api-keys.json`
2. **Check market status FIRST** (holiday detection — see Section 6)
3. **Broker sync:** Pull positions + account from Alpaca, write `positions.json`:
   ```bash
   POSITIONS=$(curl -s "$ALPACA_BASE_URL/v2/positions" \
     -H "APCA-API-KEY-ID: $ALPACA_KEY" \
     -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")
   ACCOUNT=$(curl -s "$ALPACA_BASE_URL/v2/account" \
     -H "APCA-API-KEY-ID: $ALPACA_KEY" \
     -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")
   CASH=$(echo "$ACCOUNT" | jq '.cash | tonumber')
   EQUITY=$(echo "$ACCOUNT" | jq '.equity | tonumber')
   NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
   echo "$POSITIONS" | jq --argjson cash "$CASH" --argjson equity "$EQUITY" --arg now "$NOW" \
     '{positions: [.[] | {ticker: .symbol, shares: (.qty | tonumber), avg_cost: (.avg_entry_price | tonumber), market_value: (.market_value | tonumber), unrealized_pnl: (.unrealized_pl | tonumber)}], cash: $cash, portfolio_value: $equity, last_updated: $now, source: "alpaca"}' \
     > /workspace/extra/portfolio/positions.json.tmp
   mv /workspace/extra/portfolio/positions.json.tmp /workspace/extra/portfolio/positions.json
   ```
4. **Idempotency check:** If `data/market/{today}/ready.json` already exists, exit.
5. Fetch all market data to `data/market/{today}/`
6. **Last step:** Write both `data/market/{today}/ready.json` and `data/market/ready.json` (fixed-path signal). These MUST be last.

**Ticker universe:**
```json
{
  "semiconductors": ["NVDA", "AMD", "TSM", "INTC", "AMAT", "ASML", "KLAC", "LRCX", "MRVL", "AVGO"],
  "energy": ["XOM", "CVX", "COP", "SLB", "EOG", "PXD", "MPC", "VLO", "OXY", "HAL"],
  "biotech": ["MRNA", "PFE", "LLY", "BMY", "ABBV", "AMGN", "GILD", "REGN", "VRTX", "BIIB"],
  "consumer": ["AMZN", "TSLA", "HD", "NKE", "SBUX", "MCD", "TGT", "COST", "WMT", "PG"],
  "industrials": ["CAT", "DE", "UNP", "HON", "GE", "BA", "LMT", "RTX", "MMM", "UPS"],
  "financials": ["JPM", "GS", "MS", "BAC", "WFC", "BLK", "SCHW", "AXP", "C", "USB"],
  "tech_mega": ["AAPL", "MSFT", "GOOGL", "META"],
  "sector_etfs": ["XLK", "XLE", "XLB", "XLY", "XLI", "XLF", "XLV", "XLU", "XLRE", "XLP", "XLC"],
  "macro_etfs": ["SPY", "QQQ", "IWM", "TLT", "HYG", "LQD", "GLD", "USO", "EEM", "FXI"]
}
```

**API endpoints:**

| File | API | Endpoint |
|------|-----|----------|
| `equity_quotes.json` | FMP | `/v3/quote/{all_tickers_comma_separated}` |
| `sector_etfs.json` | FMP | `/v3/quote/{sector_etf_tickers}` |
| `yield_curve.json` | FMP | `/v3/treasury?from={30d_ago}&to={today}` |
| `vix.json` | FMP | `/v3/quote/^VIX` |
| `dxy.json` | FMP | `/v3/quote/DX-Y.NYB` |
| `macro_indicators.json` | FRED | `/fred/series/observations?series_id=UNRATE` (+ CPIAUCSL, GDP, ICSA) |
| `news_sentiment.json` | Finnhub | `/api/v1/news?category=general` |

If any fetch fails, log in the sentinel's `errors` array and continue.

### 7.10 `atlas_scorecard/CLAUDE.md`

Runs at 18:00. Steps:

1. **Broker sync:** Pull EOD positions, overwrite `positions.json` (same recipe as market fetcher)
2. **HWM update:** Read `hwm.json`. If `portfolio_value > high_water_mark`, update:
   ```bash
   # After pulling positions:
   PV=$(cat /workspace/extra/portfolio/positions.json | jq '.portfolio_value')
   HWM=$(cat /workspace/extra/portfolio/hwm.json | jq '.high_water_mark')
   if [ "$(echo "$PV > $HWM" | bc -l)" = "1" ]; then
     NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
     TODAY=$(date -u +%Y-%m-%d)
     echo "{\"high_water_mark\":$PV,\"hwm_date\":\"$TODAY\",\"last_updated\":\"$NOW\"}" \
       > /workspace/extra/portfolio/hwm.json.tmp
     mv /workspace/extra/portfolio/hwm.json.tmp /workspace/extra/portfolio/hwm.json
   fi
   ```
3. **Order status reconciliation:** Pull today's orders from Alpaca, append `order_update` records to `orders_log.jsonl`
4. **Generate fill records:** For each recommendation from 5 trading days ago (≈7 calendar days) that has no fill record:
   - Fetch entry price (close on rec date) from FMP: `/v3/historical-price-full/{TICKER}?from={rec_date}&to={rec_date}`
   - Fetch exit price (close today) from FMP batch endpoint
   - Calculate `forward_return_5d = (exit_price - entry_price) / entry_price`
   - Append fill record to the agent's JSONL
   - **API budget strategy:** Use FMP batch quote for today's closes (single call). Cache entry prices in fill records. Total FMP calls per scorecard run: ~1 batch + ~20 individual historical lookups = ~25 calls. Budget: ≤50 FMP calls per scorecard run.
5. **Run deterministic scorecard math:**
   ```bash
   python3 /workspace/extra/repo/scripts/scorecard_math.py \
     /workspace/extra/scorecard/recommendations \
     /workspace/extra/scorecard/agent_scores.json \
     /workspace/extra/scorecard/darwinian_weights.json
   ```

### 7.11 `atlas_l4_autonomous_execution/CLAUDE.md`

Runs after CIO writes `portfolio_actions.json`. Steps:

1. **Pipeline integrity check (24 files):**

| Layer | Files | Count |
|-------|-------|-------|
| L1 | `state/l1/atlas_l1_{all_10}.json` | 10 |
| L2 | `state/l2/atlas_l2_{all_7}.json` | 7 |
| L3 | `state/l3/atlas_l3_{all_4}.json` | 4 |
| L4 | `atlas_l4_cro.json`, `atlas_l4_alpha_discovery.json`, `portfolio_actions.json` | 3 |
| **Total** | | **24** |

   Check each exists and has `last_updated` matching today's UTC date. Also check for holiday flags — if any file has `"holiday": true`, skip trading (expected, not a failure, no alert needed).

   If any non-holiday file is missing/stale:
   - Send Discord alert: `⚠️ ATLAS pipeline incomplete — no trades submitted. Missing: {list}`
   - Exit immediately

2. **Execute orders:**
   - For each action in `portfolio_actions.json`:
     - If `action == "HOLD"`: skip
     - If `action == "BUY"` or `action == "SELL"`:
       ```bash
       RESPONSE=$(curl -s -X POST "$ALPACA_BASE_URL/v2/orders" \
         -H "APCA-API-KEY-ID: $ALPACA_KEY" \
         -H "APCA-API-SECRET-KEY: $ALPACA_SECRET" \
         -H "Content-Type: application/json" \
         -d "{\"symbol\":\"$TICKER\",\"qty\":\"$SHARES\",\"side\":\"$SIDE\",\"type\":\"limit\",\"time_in_force\":\"day\",\"limit_price\":\"$LIMIT_PRICE\",\"extended_hours\":false}")
       ORDER_ID=$(echo "$RESPONSE" | jq -r '.id')
       ```
     - Log submission to `orders_log.jsonl` (include `type: "submission"`)
   - If order is rejected: log with `status: "rejected"`, continue with remaining orders
3. **Re-pull positions** from Alpaca (broker state may be unchanged pre-market — this is expected)
4. **No user-visible output** — wrap everything in `<internal>`

**Order settings:** `time_in_force: "day"`, `extended_hours: false` (prevent pre/post-market fills).

### 7.12 `atlas_pipeline_watchdog/CLAUDE.md` (NEW)

```
You are the ATLAS pipeline watchdog. You run at 09:30 every weekday.

Check if /workspace/extra/state/l4/portfolio_actions.json exists and has
last_updated matching today's UTC date (run: date -u +%Y-%m-%d).

Also check /workspace/extra/market/ready.json for "holiday": true.
If holiday, do nothing — this is expected.

If the pipeline completed: exit silently.
If the pipeline did NOT complete and it's not a holiday:
  Send a Discord message: "⚠️ ATLAS pipeline did not complete by 09:30. Check logs."
```

---

### Phase 3: Bootstrap Script

#### `nanoclaw/scripts/register-atlas-groups.ts`

```typescript
// Run with: npx tsx scripts/register-atlas-groups.ts
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { CronExpressionParser } from 'cron-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'store', 'messages.db');

// UPDATE THIS after creating #atlas-output Discord channel
const ATLAS_OUTPUT_JID = 'dc:ATLAS_CHANNEL_ID_HERE';

const DATA_DIR = '~/Documents/dev/bread-baker/data';
const CONFIG_DIR = '~/.config/bread-baker';
const NANOCLAW_DIR = '~/Documents/dev/bread-baker/nanoclaw';

const sharedMounts = [
  { hostPath: `${DATA_DIR}/state`, containerPath: 'state', readonly: false },
  { hostPath: `${DATA_DIR}/market`, containerPath: 'market', readonly: true },
  { hostPath: `${DATA_DIR}/scorecard`, containerPath: 'scorecard', readonly: false },
  { hostPath: `${CONFIG_DIR}`, containerPath: 'api-keys', readonly: true },
];
const portfolioMount = { hostPath: `${DATA_DIR}/portfolio`, containerPath: 'portfolio', readonly: false };

const L1_NAMES = [
  'central_bank', 'geopolitical', 'china', 'dollar', 'yield_curve',
  'commodities', 'volatility', 'emerging_markets', 'news_sentiment', 'institutional_flow',
];
const L2_NAMES = ['semiconductor', 'energy', 'biotech', 'consumer', 'industrials', 'financials', 'relationship_mapper'];
const L3_NAMES = ['druckenmiller', 'aschenbrenner', 'baker', 'ackman'];

const L1_SIGNALS = L1_NAMES.map(n => `${DATA_DIR}/state/l1/atlas_l1_${n}.json`);
const L2_SIGNALS = L2_NAMES.map(n => `${DATA_DIR}/state/l2/atlas_l2_${n}.json`);
const L3_SIGNALS = L3_NAMES.map(n => `${DATA_DIR}/state/l3/atlas_l3_${n}.json`);
const MARKET_READY = `${DATA_DIR}/market/ready.json`;
const CRO_SIGNAL = `${DATA_DIR}/state/l4/atlas_l4_cro.json`;
const ALPHA_SIGNAL = `${DATA_DIR}/state/l4/atlas_l4_alpha_discovery.json`;
const PA_SIGNAL = `${DATA_DIR}/state/l4/portfolio_actions.json`;

type GroupDef = {
  jid: string; name: string; folder: string; isMain?: boolean;
  mounts: Array<{hostPath: string; containerPath: string; readonly: boolean}>;
  tasks: Array<{prompt: string; cron: string; contextMode?: string; dependsOnSignals?: string[]; dependsOnDeadline?: string}>;
  timeout?: number;
};

const groups: GroupDef[] = [
  // Market fetcher
  {
    jid: 'atlas:market-fetcher', name: 'ATLAS Market Fetcher', folder: 'atlas_market_fetcher',
    mounts: [
      { hostPath: `${DATA_DIR}/state`, containerPath: 'state', readonly: true },
      { hostPath: `${DATA_DIR}/market`, containerPath: 'market', readonly: false },
      { hostPath: `${DATA_DIR}/scorecard`, containerPath: 'scorecard', readonly: true },
      { hostPath: `${CONFIG_DIR}`, containerPath: 'api-keys', readonly: true },
      portfolioMount,
    ],
    tasks: [{
      prompt: 'Run your daily market data fetch. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md instructions.',
      cron: '0 6 * * 1-5', contextMode: 'isolated', dependsOnSignals: [],
    }],
    timeout: 600000,
  },

  // L1 agents (10)
  ...L1_NAMES.map(name => ({
    jid: `atlas:l1-${name}`, name: `ATLAS L1 ${name}`, folder: `atlas_l1_${name}`,
    mounts: [...sharedMounts],
    tasks: [{
      prompt: 'Run your daily ATLAS analysis. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md instructions.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [MARKET_READY], dependsOnDeadline: '09:00',
    }],
    timeout: 600000,
  })),

  // L2 agents (7)
  ...L2_NAMES.map(name => ({
    jid: `atlas:l2-${name}`, name: `ATLAS L2 ${name}`, folder: `atlas_l2_${name}`,
    mounts: [...sharedMounts],
    tasks: [{
      prompt: 'Run your daily sector desk analysis. Determine today\'s date via: date -u +%Y-%m-%d. Read L1 signals from /workspace/extra/state/l1/. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: L1_SIGNALS, dependsOnDeadline: '09:00',
    }],
    timeout: 600000,
  })),

  // L3 agents (4)
  ...L3_NAMES.map(name => ({
    jid: `atlas:l3-${name}`, name: `ATLAS L3 ${name}`, folder: `atlas_l3_${name}`,
    mounts: [...sharedMounts, portfolioMount],
    tasks: [{
      prompt: 'Run your daily superinvestor review. Determine today\'s date via: date -u +%Y-%m-%d. Read sector picks from /workspace/extra/state/l2/. Read positions from /workspace/extra/portfolio/positions.json. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: L2_SIGNALS, dependsOnDeadline: '09:15',
    }],
    timeout: 600000,
  })),

  // L4 CRO
  {
    jid: 'atlas:l4-cro', name: 'ATLAS L4 CRO', folder: 'atlas_l4_cro',
    mounts: [...sharedMounts, portfolioMount],
    tasks: [{
      prompt: 'Run your daily adversarial risk review. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: L3_SIGNALS, dependsOnDeadline: '09:15',
    }],
    timeout: 600000,
  },

  // L4 Alpha Discovery
  {
    jid: 'atlas:l4-alpha', name: 'ATLAS L4 Alpha Discovery', folder: 'atlas_l4_alpha_discovery',
    mounts: [...sharedMounts, portfolioMount],
    tasks: [{
      prompt: 'Run your daily alpha discovery. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: L3_SIGNALS, dependsOnDeadline: '09:15',
    }],
    timeout: 600000,
  },

  // L4 CIO
  {
    jid: 'atlas:l4-cio', name: 'ATLAS L4 CIO', folder: 'atlas_l4_cio',
    mounts: [...sharedMounts, portfolioMount],
    tasks: [{
      prompt: 'Run your daily portfolio synthesis. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [CRO_SIGNAL, ALPHA_SIGNAL], dependsOnDeadline: '09:25',
    }],
    timeout: 600000,
  },

  // Autonomous Execution
  {
    jid: 'atlas:l4-ae', name: 'ATLAS L4 Autonomous Execution', folder: 'atlas_l4_autonomous_execution',
    mounts: [...sharedMounts, portfolioMount],
    tasks: [{
      prompt: 'Run your daily trade execution. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.',
      cron: '0 6 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [PA_SIGNAL], dependsOnDeadline: '09:25',
    }],
    timeout: 600000,
  },

  // Pipeline Watchdog
  {
    jid: 'atlas:watchdog', name: 'ATLAS Pipeline Watchdog', folder: 'atlas_pipeline_watchdog',
    mounts: [
      { hostPath: `${DATA_DIR}/state`, containerPath: 'state', readonly: true },
      { hostPath: `${DATA_DIR}/market`, containerPath: 'market', readonly: true },
    ],
    tasks: [{
      prompt: 'Check if the ATLAS pipeline completed today. Follow your CLAUDE.md.',
      cron: '30 9 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [],
    }],
    timeout: 120000,
  },

  // Scorecard
  {
    jid: 'atlas:scorecard', name: 'ATLAS Scorecard', folder: 'atlas_scorecard',
    mounts: [
      ...sharedMounts, portfolioMount,
      { hostPath: NANOCLAW_DIR, containerPath: 'repo', readonly: true },
    ],
    tasks: [{
      prompt: 'Run your daily scorecard update. Determine today\'s date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.',
      cron: '0 18 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [],
    }],
    timeout: 600000,
  },

  // Autoresearch
  {
    jid: 'atlas:autoresearch', name: 'ATLAS Autoresearch', folder: 'atlas_autoresearch',
    mounts: [
      ...sharedMounts,
      { hostPath: NANOCLAW_DIR, containerPath: 'repo', readonly: false },
      { hostPath: `${NANOCLAW_DIR}/groups`, containerPath: 'groups', readonly: false },
    ],
    tasks: [{
      prompt: 'Run your daily autoresearch cycle. Follow your CLAUDE.md.',
      cron: '0 20 * * 1-5', contextMode: 'isolated' as const,
      dependsOnSignals: [],
    }],
    timeout: 600000,
  },

  // Autoresearch Evaluator
  {
    jid: 'atlas:evaluator', name: 'ATLAS Autoresearch Evaluator', folder: 'atlas_autoresearch_evaluator',
    mounts: [
      ...sharedMounts,
      { hostPath: NANOCLAW_DIR, containerPath: 'repo', readonly: false },
      { hostPath: `${NANOCLAW_DIR}/groups`, containerPath: 'groups', readonly: false },
    ],
    tasks: [{
      prompt: 'Run your weekly autoresearch evaluation. Follow your CLAUDE.md.',
      cron: '30 20 * * 1', contextMode: 'isolated' as const,
      dependsOnSignals: [],
    }],
    timeout: 600000,
  },
];

// Insert groups + tasks
const db = new Database(DB_PATH);

// Ensure schema columns exist
try { db.exec("ALTER TABLE scheduled_tasks ADD COLUMN depends_on_signals TEXT DEFAULT NULL"); } catch {}
try { db.exec("ALTER TABLE scheduled_tasks ADD COLUMN depends_on_deadline TEXT DEFAULT NULL"); } catch {}

db.exec(`CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  trading_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  UNIQUE(task_id, trading_date)
)`);

for (const group of groups) {
  db.prepare(`INSERT OR REPLACE INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(group.jid, group.name, group.folder, '__scheduled__', new Date().toISOString(),
         JSON.stringify({ additionalMounts: group.mounts, timeout: group.timeout || 600000 }), 0, group.isMain ? 1 : 0);

  for (const task of group.tasks) {
    const taskId = `atlas-${group.folder}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextRun = CronExpressionParser.parse(task.cron, {
      tz: 'America/New_York'
    }).next().toISOString();
    const signals = task.dependsOnSignals?.length ? JSON.stringify(task.dependsOnSignals) : null;
    db.prepare(`INSERT OR REPLACE INTO scheduled_tasks (id, group_folder, chat_jid, prompt, schedule_type, schedule_value, context_mode, next_run, status, created_at, depends_on_signals, depends_on_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(taskId, group.folder, ATLAS_OUTPUT_JID, task.prompt, 'cron', task.cron,
           task.contextMode || 'isolated', nextRun, 'active', new Date().toISOString(),
           signals, task.dependsOnDeadline || null);
  }
}

console.log(`Registered ${groups.length} groups with tasks`);
```

**Idempotency:** Uses `INSERT OR REPLACE` — safe to re-run. Note that re-running generates new task IDs, so stale tasks from previous runs should be cleaned up:

```sql
DELETE FROM scheduled_tasks WHERE group_folder LIKE 'atlas_%' AND id NOT IN (
  SELECT id FROM scheduled_tasks WHERE group_folder LIKE 'atlas_%' ORDER BY created_at DESC
);
```

---

## 8. Task Prompt Design

NanoClaw does NOT interpolate template variables. Do not use `{DATE}` or `{YOUR_FOLDER}` — they appear as literal text. Agents determine dates via `date -u +%Y-%m-%d`. Output paths are hard-coded in each CLAUDE.md.

Prompts are generic — the CLAUDE.md differentiates:

- **L1:** `Run your daily ATLAS analysis. Determine today's date via: date -u +%Y-%m-%d. Follow your CLAUDE.md instructions.`
- **L2:** `Run your daily sector desk analysis. Determine today's date via: date -u +%Y-%m-%d. Read L1 signals from /workspace/extra/state/l1/. Follow your CLAUDE.md.`
- **L3:** `Run your daily superinvestor review. Determine today's date via: date -u +%Y-%m-%d. Read sector picks from /workspace/extra/state/l2/. Read positions from /workspace/extra/portfolio/positions.json. Follow your CLAUDE.md.`
- **L4 CRO:** `Run your daily adversarial risk review. Determine today's date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.`
- **L4 CIO:** `Run your daily portfolio synthesis. Determine today's date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.`
- **L4 AE:** `Run your daily trade execution. Determine today's date via: date -u +%Y-%m-%d. Follow your CLAUDE.md.`

---

## 9. Implementation Order

Execute in this exact sequence to enable incremental testing:

1. **Extend `src/db.ts` and `src/scheduler.ts`** — add columns, dependency check, deadline logic, task_runs table. Rebuild.
2. **Create `~/.config/bread-baker/mount-allowlist.json`**
3. **Create data directory structure** + initialize `darwinian_weights.json`, `agent_scores.json`, `hwm.json`, `orders_log.jsonl`, `autoresearch_log.jsonl`
4. **Update `container/Dockerfile`** — add numpy, jq, git config. Rebuild image.
5. **Add env vars** — `MAX_CONCURRENT_CONTAINERS=30`, `SCHEDULER_POLL_INTERVAL=15000`. Update `src/config.ts`. Rebuild and restart.
6. **Create `nanoclaw/scripts/scorecard_math.py`**
7. **Create Discord `#atlas-output` channel** — get ID, update bootstrap script
8. **Write `atlas_l1_central_bank/CLAUDE.md`** — reference implementation
9. **Write `register-atlas-groups.ts` with just market_fetcher + central_bank** — run bootstrap
10. **Manual test:** Write fake `data/market/ready.json` → verify central_bank fires and writes output. Verify without `ready.json` it does NOT fire.
11. **Write `atlas_market_fetcher/CLAUDE.md`** — test end-to-end at 06:00
12. **Write remaining 9 L1 agents** — add to bootstrap, test all 10 fire after market fetcher
13. **Write and test L2 agents** — verify they fire after all 10 L1 signals
14. **Write and test L3 agents**
15. **Write L4 agents** — CRO, Alpha Discovery, CIO (most complex), AE
16. **Write `atlas_pipeline_watchdog/CLAUDE.md`**
17. **Write `atlas_scorecard/CLAUDE.md`** — test with simulated recommendation data
18. **Write `atlas_autoresearch/CLAUDE.md`** — test direct-to-main commit
19. **Write `atlas_autoresearch_evaluator/CLAUDE.md`** — test with pre-written pending entry
20. **Full pipeline dry run** — next weekday 06:00, observe all logs

---

## 10. Key Constraints and Non-Negotiables

| Constraint | Why |
|------------|-----|
| All dates/timestamps in UTC | Prevents timezone mismatches between scheduler and agents |
| Atomic writes (temp + mv) for all JSON | Prevents corrupt files from mid-write crashes |
| Do NOT mount `.ssh`, `.gnupg`, `.env`, or credentials | Security |
| Autoresearch commits directly to `main` — NO branches | v1 branch model was fundamentally broken |
| Autoresearch log is JSONL, not markdown | Machine-parseable, prevents brittle string parsing |
| Bootstrap script uses `INSERT OR REPLACE` | Idempotent, safe to re-run |
| Each agent checks today's date AND holiday flag | Prevents stale-data cascades and false holiday alerts |
| All agents wrap analysis in `<internal>` tags | Keeps #atlas-output clean |
| CIO is the ONLY agent with user-visible Discord output | Single source of truth |
| Scorecard JSONL is append-only | Audit trail integrity |
| `positions.json` is NEVER computed — always pulled from Alpaca | Prevents broker drift |
| AE verifies all 24 upstream files before touching Alpaca | Last safety gate |
| AE uses `extended_hours: false` | Prevent unexpected pre-market fills |
| v1 is long-only — no SHORT execution | Defer borrow/margin complexity to v2 |
| Darwinian scoring is per-layer | Prevents apples-to-oranges comparisons |
| CIO is excluded from Darwinian weights | Self-referential loop |
| Scheduler advances `next_run` on both success AND failure | Prevents infinite retry loops |
| Dependency deadlines prevent silent stalls | Pipeline must fail visibly, not stall forever |
| Market fetcher checks Alpaca `/v2/clock` for holidays FIRST | Clean holiday propagation |
| Scorecard math is a static Python script | Deterministic, testable, no LLM hallucination risk |
| `recommendation_id` uniquely identifies each recommendation | Enables reliable fill-record joining |

---

## 11. API Budget

| Agent | API | Calls/day | Notes |
|-------|-----|-----------|-------|
| Market fetcher | FMP | ~7 | Batch quotes + treasury + VIX + DXY |
| Market fetcher | FRED | 4 | UNRATE, CPI, GDP, ICSA |
| Market fetcher | Finnhub | 1 | General news |
| Market fetcher | Alpaca | 3 | Clock + positions + account |
| AE | Alpaca | ~6 | 1-5 order submissions + position re-pull |
| Scorecard | Alpaca | 3 | Positions + account + orders |
| Scorecard | FMP | ~50 | Batch close + individual historical lookups |
| **Daily total** | FMP | ~57 | Well within 250/day free tier |
| **Daily total** | Alpaca | ~12 | No limits on paper trading |

L1, L2, L3, L4 analysis agents do NOT make API calls. They read pre-fetched data only. This is enforced by giving them read-only `api-keys` mounts but no instruction to use APIs. The only agents with API call instructions in their CLAUDE.md are: market fetcher, AE, and scorecard.

---

## 12. Observability

**Pipeline health signals:**
1. `task_runs` table tracks every task execution with status and timestamps
2. Pipeline watchdog alerts at 09:30 if morning pipeline incomplete
3. AE alerts if any upstream agent is missing/stale
4. Scheduler alerts when dependency deadlines expire

**Debugging:**
```bash
# Recent task runs
sqlite3 store/messages.db 'SELECT * FROM task_runs WHERE trading_date = date("now") ORDER BY started_at'

# Failed tasks
sqlite3 store/messages.db 'SELECT * FROM task_runs WHERE status IN ("failed","deadline_expired") ORDER BY trading_date DESC LIMIT 20'

# Scheduled task status
sqlite3 store/messages.db 'SELECT group_folder, next_run, status FROM scheduled_tasks WHERE group_folder LIKE "atlas_%" ORDER BY group_folder'
```

**Stale file cleanup:** The market fetcher, at startup, deletes state files from `data/state/l*/*.json` that are older than 7 days. This prevents accumulation over months.

---

*End of implementation spec v2. The implementing agent should follow Phase 1 → Phase 2 → Phase 3 in order, testing after each phase before proceeding.*
