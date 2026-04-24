# ATLAS Groups Bootstrap Script - I-041

## Summary

Created `/workspace/extra/bread-baker/nanoclaw/scripts/register-atlas-groups.ts` bootstrap script and executed it successfully.

## What Was Created

**Script Location:** `/workspace/extra/bread-baker/nanoclaw/scripts/register-atlas-groups.ts`

**Run Command:** `npx tsx scripts/register-atlas-groups.ts`

## Registered Groups (30 total)

### Market Fetcher (1)
| JID | Name | Cron | Dependencies |
|-----|------|------|--------------|
| atlas:market-fetcher | ATLAS Market Fetcher | 0 6 * * 1-5 | None |

### L1 Agents (10)
| JID | Name | Cron | Dependencies |
|-----|------|------|--------------|
| atlas:l1-central_bank | ATLAS L1 central_bank | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-geopolitical | ATLAS L1 geopolitical | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-china | ATLAS L1 china | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-dollar | ATLAS L1 dollar | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-yield_curve | ATLAS L1 yield_curve | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-commodities | ATLAS L1 commodities | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-volatility | ATLAS L1 volatility | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-emerging_markets | ATLAS L1 emerging_markets | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-news_sentiment | ATLAS L1 news_sentiment | 0 6 * * 1-5 | market/ready.json |
| atlas:l1-institutional_flow | ATLAS L1 institutional_flow | 0 6 * * 1-5 | market/ready.json |

### L2 Agents (7)
| JID | Name | Cron | Dependencies |
|-----|------|------|--------------|
| atlas:l2-semiconductor | ATLAS L2 semiconductor | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-energy | ATLAS L2 energy | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-biotech | ATLAS L2 biotech | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-consumer | ATLAS L2 consumer | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-industrials | ATLAS L2 industrials | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-financials | ATLAS L2 financials | 0 6 * * 1-5 | All 10 L1 signals |
| atlas:l2-relationship_mapper | ATLAS L2 relationship_mapper | 0 6 * * 1-5 | All 10 L1 signals |

### L3 Agents (4)
| JID | Name | Cron | Dependencies |
|-----|------|------|--------------|
| atlas:l3-druckenmiller | ATLAS L3 druckenmiller | 0 6 * * 1-5 | All 7 L2 signals |
| atlas:l3-aschenbrenner | ATLAS L3 aschenbrenner | 0 6 * * 1-5 | All 7 L2 signals |
| atlas:l3-baker | ATLAS L3 baker | 0 6 * * 1-5 | All 7 L2 signals |
| atlas:l3-ackman | ATLAS L3 ackman | 0 6 * * 1-5 | All 7 L2 signals |

### L4 Agents (4)
| JID | Name | Cron | Dependencies |
|-----|------|------|--------------|
| atlas:l4-cro | ATLAS L4 CRO | 0 6 * * 1-5 | All 4 L3 signals |
| atlas:l4-alpha | ATLAS L4 Alpha Discovery | 0 6 * * 1-5 | All 4 L3 signals |
| atlas:l4-cio | ATLAS L4 CIO | 0 6 * * 1-5 | CRO + Alpha signals |
| atlas:l4-ae | ATLAS L4 Autonomous Execution | 0 6 * * 1-5 | portfolio_actions.json |

### Infrastructure (5)
| JID | Name | Cron | Timeout |
|-----|------|------|---------|
| atlas:watchdog | ATLAS Pipeline Watchdog | 30 9 * * 1-5 | 120000ms |
| atlas:scorecard | ATLAS Scorecard | 0 18 * * 1-5 | 600000ms |
| atlas:autoresearch | ATLAS Autoresearch | 0 20 * * 1-5 | 600000ms |
| atlas:evaluator | ATLAS Autoresearch Evaluator | 30 20 * * 1 | 600000ms |

## Mount Configurations

### Shared Mounts (L1-L4 agents)
- `~/Documents/dev/bread-baker/data/state` -> `state` (readonly: false for L1-L4, true for infrastructure)
- `~/Documents/dev/bread-baker/data/market` -> `market` (readonly: true)
- `~/Documents/dev/bread-baker/data/scorecard` -> `scorecard` (readonly: false)
- `~/.config/bread-baker` -> `api-keys` (readonly: true)

### Portfolio Mount (L3, L4, Market Fetcher, Scorecard)
- `~/Documents/dev/bread-baker/data/portfolio` -> `portfolio` (readonly: false)

### Repository Mounts (Scorecard, Autoresearch, Evaluator)
- `~/Documents/dev/bread-baker/nanoclaw` -> `repo` (readonly: true/false varies)
- `~/Documents/dev/bread-baker/nanoclaw/groups` -> `groups` (readonly: false for autoresearch)

## Timeout Settings

- **Agents (L1-L4, Market Fetcher, Scorecard, Autoresearch, Evaluator):** 600000ms (10 minutes)
- **Watchdog:** 120000ms (2 minutes)

## Notes

- **ATLAS_OUTPUT_JID:** Set to `'TODO_REPLACE_WITH_CHANNEL_ID'` - needs to be updated after I-040 (Discord channel creation) completes
- **Idempotency:** Uses `INSERT OR REPLACE` - safe to re-run
- **Database:** Uses `store/messages.db` SQLite database
- **Task Runs Table:** Created `task_runs` table for tracking execution status per trading date
- **Dependencies:** Uses `depends_on_signals` and `depends_on_deadline` columns in `scheduled_tasks` table

## Verification

Script executed successfully and verified:
- 30 groups registered in `registered_groups` table
- 30 tasks registered in `scheduled_tasks` table
- All cron schedules correctly applied
- All dependency gates correctly configured
- All mount configurations correctly set
