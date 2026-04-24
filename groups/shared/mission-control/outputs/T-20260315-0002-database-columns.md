# Task T-20260315-0002: Database Columns for Dependency-Gated Scheduling

## Summary

Added database columns and table for dependency-gated scheduling to the NanoClaw target instance at `/workspace/extra/bread-baker/nanoclaw/`.

## Changes Made

### 1. db.ts Schema Updates

**Migration for `scheduled_tasks` table:**
- Added `depends_on_signals TEXT` column (with migration for existing DBs)
- Added `depends_on_deadline TEXT` column (with migration for existing DBs)

**New `task_runs` table:**
```sql
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  result TEXT,
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_task_runs_task_id ON task_runs(task_id);
```

### 2. types.ts Updates

- Added optional `depends_on_signals` and `depends_on_deadline` fields to `ScheduledTask` interface
- Added new `TaskRun` interface for the task_runs table

### 3. createTask Function Update

Updated `createTask` function to accept the new optional fields with proper defaults.

## Verification

- Build: `npm run build` - PASSED
- Tests: `npm test` - 235 tests PASSED
- No SQLite errors after applying schema changes

## Files Modified

- `/workspace/extra/bread-baker/nanoclaw/src/db.ts` - Schema migrations and createTask function
- `/workspace/extra/bread-baker/nanoclaw/src/types.ts` - Type definitions
