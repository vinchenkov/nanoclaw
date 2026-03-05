# Isolate Agent Directives

## Problem

Both `homie` and `worker` groups mount `groups/homie/` as an additional mount (`/workspace/extra/homie`). Combined with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: 1`, this means:

- **Worker autoloads Homie's CLAUDE.md** (the full orchestrator contract) — worker shouldn't see planner internals
- **Homie's group dir is a grab-bag** — it contains both private directive state (CLAUDE.md, briefings) and shared operational state (mission-control, bin/mc.ts)

## Goal

Neither agent sees the other's CLAUDE.md/directive. Both retain read-write access to shared operational state (mission-control, mc CLI, outputs).

## Changes

### 1. Extract shared state out of `groups/homie/`

Create `groups/shared/` as the new home for operational state:

```
groups/shared/
  mission-control/
    tasks/
    initiatives/
    outputs/
    activity.log.ndjson
    lock.json
  bin/mc.ts
```

Move (git mv) from `groups/homie/`:
- `mission-control/` → `groups/shared/mission-control/`
- `bin/mc.ts` → `groups/shared/bin/mc.ts`

What stays in `groups/homie/`:
- `CLAUDE.md` (orchestrator contract — private)
- `briefings/` (only homie reads/writes)

### 2. Update mount configuration

**Before (both groups):**
```
additionalMounts: [
  { hostPath: "groups/homie", containerPath: "homie", readwrite: true }
]
```

**After:**
- Remove `groups/homie` from both groups' `additionalMounts`
- Add `groups/shared` to both groups' `additionalMounts` (rw)
- Container path: `/workspace/extra/shared`

Update `~/.config/nanoclaw/mount-allowlist.json`:
- Remove `~/Documents/dev/claws/NanoClaw/groups/homie`
- Add `~/Documents/dev/claws/NanoClaw/groups/shared`

### 3. Update path references in both CLAUDE.md files

All occurrences of `/workspace/extra/homie/mission-control/` → `/workspace/extra/shared/mission-control/`
All occurrences of `/workspace/extra/homie/bin/mc.ts` → `/workspace/extra/shared/bin/mc.ts`

The `mc.ts --base-dir` flag changes from `--base-dir /workspace/extra/homie` to `--base-dir /workspace/extra/shared`.

### 4. Update Homie's CLAUDE.md

- Remove the "Worker Briefing" section entirely. Worker has its own `groups/worker/CLAUDE.md` that autoloads — Homie doesn't need to tell it where to find instructions.
- Simplify the dispatch prompt in Step 6 to just provide the task ID:
  ```
  You are a worker agent. Your task ID is <TASK_ID>.
  ```
- Update all `Workspace Context` / `Canonical State` paths to use `/workspace/extra/shared/`

### 5. Update Worker's CLAUDE.md

- Update all paths from `/workspace/extra/homie/` to `/workspace/extra/shared/`
- Remove any references to Homie's CLAUDE.md or workers/CLAUDE.md

### 6. Update mc.ts `--base-dir` default

If `mc.ts` has a hardcoded default base dir, update it to work with the new `groups/shared/` layout. Verify it resolves `mission-control/` relative to its own location or the `--base-dir` flag.

### 7. No code changes needed in NanoClaw core

The additional mounts are stored in the DB (`registered_groups.container_config`). The update is a data migration — update the DB rows for both groups. The `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` setting remains enabled (it's useful for `dirtsignals` and other extra mounts), but now neither agent cross-loads the other's directive since `groups/homie` is no longer mounted into worker.

## Migration Steps

1. `git mv groups/homie/mission-control groups/shared/mission-control`
2. `git mv groups/homie/bin groups/shared/bin`
3. Update both CLAUDE.md files (paths + remove Worker Briefing from Homie)
4. Update mount allowlist JSON
5. Update registered group configs in DB (change additionalMounts for both homie and worker)
6. Verify `mc.ts` works with new `--base-dir /workspace/extra/shared`
7. Update project `CLAUDE.md` docs to reflect new layout

## Verification

- Homie container: `ls /workspace/extra/shared/mission-control/tasks/` works
- Homie container: no `/workspace/extra/homie/` mount exists (only its own `/workspace/group/` which is `groups/homie/`)
- Worker container: `ls /workspace/extra/shared/mission-control/tasks/` works
- Worker container: no access to Homie's CLAUDE.md
- Both can run `node /workspace/extra/shared/bin/mc.ts --base-dir /workspace/extra/shared task list`
