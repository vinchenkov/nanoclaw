# Dependency-Gated Scheduling Implementation

## Summary
Implemented dependency-gated scheduling logic in task-scheduler.ts and db.ts to control when scheduled tasks run based on signal file dependencies and deadlines.

## Changes Made

### 1. task-scheduler.ts - Added Helper Functions

**dependenciesMet(task: ScheduledTask): boolean** (lines 25-62)
- Checks if all dependency signal files exist
- Parses `depends_on_signals` field as either:
  - JSON array: `["signal1.txt", "signal2.txt"]`
  - Comma-separated: `signal1.txt,signal2.txt`
- Returns `true` if no dependencies or all signal files exist in `data/signals/`
- Returns `false` if any signal file is missing

**pastDeadline(task: ScheduledTask): boolean** (lines 64-87)
- Checks if the task's deadline has passed
- Parses `depends_on_deadline` as ISO date string
- Returns `true` if deadline has passed (now > deadline)
- Returns `false` if no deadline or deadline is invalid

### 2. db.ts - Updated getDueTasks() Function

Added filtering logic to `getDueTasks()` (lines 573-591):
- Filters out tasks where dependencies are not met (signal files missing)
- Filters out tasks where deadline exists but hasn't passed yet
- Only returns tasks that are ready to execute

## Files Modified

1. `/workspace/extra/bread-baker/nanoclaw/src/task-scheduler.ts`
   - Added imports: `path` from 'path', `DATA_DIR` from config
   - Added `dependenciesMet()` function (exported)
   - Added `pastDeadline()` function (exported)

2. `/workspace/extra/bread-baker/nanoclaw/src/db.ts`
   - Added helper functions: `taskDependenciesMet()`, `taskPastDeadline()`
   - Updated `getDueTasks()` to filter by dependencies and deadlines

## Verification
- TypeScript compilation passes with no errors
- Functions handle edge cases:
  - Null/undefined dependencies (no blocking)
  - Invalid deadline format (doesn't block)
  - Missing signal files (blocks task)
  - Deadline not yet passed (blocks task)