# Multi-agent groups (homie / worker / verifier / critic)

## Intent
The fork layers a four-agent system on top of the single-group NanoClaw model: `homie` is the Discord-facing orchestrator (main group, ticks every 5 minutes), `worker` executes tasks dispatched by homie, `verifier` reviews worker deliverables, and `critic` is an out-of-band adherence reviewer with elevated mounts (read all groups, commit prompt edits). Coordination state lives in a shared mission-control plane at `groups/shared/mission-control/` (tasks, initiatives, outputs, revisions, activity log, worker lock), accessed exclusively via the `mc.ts` CLI. A separate dashboard process exposes the same state on port `4377`. The host process seeds the critic group and the heartbeat task at startup, and the container runner adds group-specific mounts (critic gets `groups/`, `data/sessions/`, and `.git`; the others get `dirtsignals` and `groups/shared` via the additional-mounts allowlist).

## Files touched

```
groups/
  homie/AGENTS.md                  (new, 25482 bytes)
  homie/AGENT-SPIRIT.md            (new, 1605 bytes)
  homie/CLAUDE.md                  (symlink → AGENTS.md)
  worker/AGENTS.md                 (new, 14349 bytes)
  worker/AGENT-SPIRIT.md           (new, 1788 bytes)
  worker/CLAUDE.md                 (symlink → AGENTS.md)
  verifier/AGENTS.md               (new, 7879 bytes)
  verifier/AGENT-SPIRIT.md         (new, 1749 bytes)
  verifier/CLAUDE.md               (symlink → AGENTS.md)
  critic/AGENTS.md                 (new, 8966 bytes)
  critic/CLAUDE.md                 (symlink → AGENTS.md)
  shared/bin/mc.ts                 (new, 47039 bytes — mission-control CLI)
  shared/bin/dashboard-server.mjs  (new, 104167 bytes — dashboard web UI)
  shared/mission-control/          (state directory, populated at runtime)

src/
  db.ts            (added seedRegisteredGroup + seedScheduledTasks)
  index.ts         (call seed* at startup; spawnAgent IPC callback)
  container-runner.ts (critic-only mounts + GIT_AUTHOR_* env)

host (outside repo):
  ~/.config/nanoclaw/mount-allowlist.json  (allow dirtsignals + groups/shared)
```

## How to apply

### 1. Create the group directories and AGENT directives

For each of `homie`, `worker`, `verifier`, `critic`, the migrator must copy the prose files **verbatim** from the user's reference tree at `groups/<folder>/`. Do not regenerate or paraphrase; these files encode the agent contracts and the auto-engineer loop reads/writes against them.

For each group folder:

1. `mkdir -p groups/<folder>`
2. Copy `AGENTS.md` from the user's tree at `groups/<folder>/AGENTS.md`.
3. (homie / worker / verifier only) Copy `AGENT-SPIRIT.md` from the user's tree at `groups/<folder>/AGENT-SPIRIT.md`. The critic group does NOT have an AGENT-SPIRIT.md — by design, critic must not edit other agents' spirit files, but critic itself does not have one.
4. Create `CLAUDE.md` as a symlink to `AGENTS.md`:
   ```bash
   ln -sf AGENTS.md groups/<folder>/CLAUDE.md
   ```
   (All four groups have the symlink — including critic, even though critic is normally spawned with isolated context.)
5. Create empty subdirs that get populated at runtime:
   - `groups/homie/briefings/` and `groups/homie/logs/`
   - `groups/worker/logs/`
   - `groups/verifier/logs/`
   - `groups/critic/critiques/` and `groups/critic/logs/`
6. (homie / worker / verifier only) Initialize `prompt-metrics.json` with `{}` if the auto-engineer loop will run; otherwise leave it for the critic to create.

Verbatim source paths (sizes for sanity-check):

| Path | Size |
|---|---|
| `groups/homie/AGENTS.md` | 25482 bytes |
| `groups/homie/AGENT-SPIRIT.md` | 1605 bytes |
| `groups/worker/AGENTS.md` | 14349 bytes |
| `groups/worker/AGENT-SPIRIT.md` | 1788 bytes |
| `groups/verifier/AGENTS.md` | 7879 bytes |
| `groups/verifier/AGENT-SPIRIT.md` | 1749 bytes |
| `groups/critic/AGENTS.md` | 8966 bytes |

### 2. Add mission-control bin

Copy both files **verbatim** from the user's tree to `groups/shared/bin/`:

| Path | Size | Purpose |
|---|---|---|
| `groups/shared/bin/mc.ts` | 47039 bytes | Standalone, zero-dep TS CLI run with `node` (no transpile). Operates on `mission-control/` files. |
| `groups/shared/bin/dashboard-server.mjs` | 104167 bytes | Vanilla HTTP server exposing the mission-control state as a web dashboard. Default port `4377` (overridable via `--port` or `DASHBOARD_PORT`). |

`mc.ts` exposes three top-level resources, each with subcommands. Agents must go through this CLI rather than touching the JSON/markdown directly:

- `task` — `create`, `get`, `list`, `update`
- `initiative` — `create`, `get`, `list`, `update`
- `lock` — `status`, `acquire`, `release`, `update`

Invocation pattern from inside a container:
```
node /workspace/extra/shared/bin/mc.ts --base-dir /workspace/extra/shared <resource> <command> [flags]
```

When `--base-dir` is omitted, `mc.ts` resolves `mission-control/` relative to the script directory or `cwd`. Output is JSON on stdout; non-zero exit on error. Activity entries should set `actor` to the group folder name (`homie`/`worker`/`verifier`), never the assistant display name or a task id.

Make `dashboard-server.mjs` executable (`chmod +x`). It is run on the host (outside any container) and reads the same mission-control state directly.

Also create the `groups/shared/mission-control/` directory tree — the subdirs `tasks/`, `initiatives/`, `outputs/`, `revisions/`, plus an empty `activity.log.ndjson` and `lock.json` (initial content `{"locked": false}`). `mc.ts` will lazily create most of these on first write, but seeding them avoids first-run races.

### 3. Add seed functions to src/db.ts

Append the following to `src/db.ts`. The first block goes inside `createSchema` after the existing column-add try/catch (for the sessions composite-PK migration — note that the schema/CREATE TABLE part of this is owned by section 01, so only the in-place migration should land here if the new schema is already applied). The `SeedTask` type and the two `seed*` functions are top-level exports.

In-place migration block (inside `createSchema`, after the existing column-add try/catch):

```ts
  // Migrate sessions table to composite PK (group_folder, sdk)
  try {
    database.exec(
      `ALTER TABLE sessions ADD COLUMN sdk TEXT NOT NULL DEFAULT 'claude'`,
    );
    // Recreate with composite PK: create new table, copy, swap
    database.exec(`
      CREATE TABLE sessions_new (
        group_folder TEXT NOT NULL,
        sdk TEXT NOT NULL DEFAULT 'claude',
        session_id TEXT NOT NULL,
        PRIMARY KEY (group_folder, sdk)
      );
      INSERT INTO sessions_new SELECT group_folder, sdk, session_id FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;
    `);
  } catch {
    /* already migrated */
  }
```

`SeedTask` type and `seedScheduledTasks` (top-level exports — note `INSERT OR IGNORE` semantics so manually edited rows are never overwritten, plus a `replaces` field to migrate old task ids in place):

```ts
export interface SeedTask {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  context_mode?: string;
}

/**
 * Ensure required scheduled tasks exist in the database.
 * Uses INSERT OR IGNORE so manually edited rows are never overwritten.
 * Pass `replaces` to migrate from an old task id (updates in place).
 */
export function seedScheduledTasks(
  tasks: (SeedTask & { replaces?: string })[],
): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO scheduled_tasks (id, group_folder, chat_jid, prompt, schedule_type, schedule_value, context_mode, next_run, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'active', datetime('now'))
  `);
  const migrate = db.prepare(
    `UPDATE scheduled_tasks SET id = ?, schedule_value = ? WHERE id = ?`,
  );

  for (const t of tasks) {
    if (t.replaces) {
      const changed = migrate.run(t.id, t.schedule_value, t.replaces);
      if (changed.changes > 0) continue;
    }
    insert.run(
      t.id,
      t.group_folder,
      t.chat_jid,
      t.prompt,
      t.schedule_type,
      t.schedule_value,
      t.context_mode || 'isolated',
    );
  }
}
```

`seedRegisteredGroup` (place near `setRegisteredGroup`; reuses its `isValidGroupFolder` guard):

```ts
export function seedRegisteredGroup(jid: string, group: RegisteredGroup): void {
  if (!isValidGroupFolder(group.folder)) {
    throw new Error(`Invalid group folder "${group.folder}" for JID ${jid}`);
  }
  db.prepare(
    `INSERT OR IGNORE INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    jid,
    group.name,
    group.folder,
    group.trigger,
    group.added_at,
    group.containerConfig ? JSON.stringify(group.containerConfig) : null,
    group.requiresTrigger === undefined ? 1 : group.requiresTrigger ? 1 : 0,
    group.isMain ? 1 : 0,
  );
}
```

Also update the legacy JSON migration helper at the bottom of `db.ts` to pass the SDK to `setSession`:

```ts
      setSession(folder, 'claude', sessionId);
```

### 4. Wire seeding into src/index.ts startup

In `src/index.ts`, add `seedRegisteredGroup` and `seedScheduledTasks` to the `./db.js` import block, then call them inside `main()` immediately after `initDatabase()` and before `loadState()`:

```ts
async function main(): Promise<void> {
  ensureContainerSystemRunning();
  initDatabase();
  seedRegisteredGroup('critic-agent', {
    name: 'Critic',
    folder: 'critic',
    trigger: '',
    added_at: new Date().toISOString(),
    requiresTrigger: false,
    isMain: false,
  });
  seedScheduledTasks([
    {
      id: 'heartbeat-5min',
      replaces: 'heartbeat-15min',
      group_folder: 'homie',
      chat_jid: 'dc:1468824513654423697',
      prompt: 'Execute your orchestrator tick loop.',
      schedule_type: 'interval',
      schedule_value: '300000',
      context_mode: 'isolated',
    },
  ]);
  logger.info('Database initialized');
  loadState();
  // …
}
```

Notes for the migrator:
- The critic JID `critic-agent` is a synthetic identifier (no real channel) — critic is only ever invoked via IPC `spawn_agent` from another group. Do not register it through any channel-discovery flow.
- The heartbeat `chat_jid` (`dc:1468824513654423697`) is the user's Discord channel id; substitute the appropriate value if the install has a different main JID.
- `replaces: 'heartbeat-15min'` migrates an older fork that ticked every 15 minutes; the `migrate` UPDATE happens before `INSERT OR IGNORE` so the row keeps any user edits while shifting the id and the interval.

The wider `spawnAgent` callback wired into the IPC dispatcher is covered in section 03 (IPC + agent spawning); only the `seed*` calls belong here.

### 5. Configure container mounts for the four groups

In `src/container-runner.ts`, the mount logic for `homie` / `worker` / `verifier` is satisfied by the additional-mounts allowlist (step 6 below), which the runner consumes via `validateAdditionalMounts()`. Those three groups should have a `containerConfig.mounts` entry that requests `dirtsignals` and `groups/shared` at `/workspace/extra/dirtsignals` and `/workspace/extra/shared` respectively (read-write).

Critic mounts are coded directly in the runner — append the following block to `buildVolumeMounts`, immediately after the additional-mounts validation (and before the function returns `mounts`):

```ts
  // Critic gets read-write access to group AGENTS.md files and codex session logs,
  // plus a .git mount so it can commit prompt edits.
  if (group.folder === 'critic') {
    mounts.push({
      hostPath: GROUPS_DIR,
      containerPath: '/workspace/groups',
      readonly: false,
    });
    mounts.push({
      hostPath: path.join(DATA_DIR, 'sessions'),
      containerPath: '/workspace/sessions',
      readonly: true,
    });
    mounts.push({
      hostPath: path.join(projectRoot, '.git'),
      containerPath: '/workspace/.git',
      readonly: false,
    });
  }
```

In `runContainerAgent`, inject the critic-only env vars when assembling `containerEnv`:

```ts
  const containerEnv: Record<string, string> = {
    NANOCLAW_AGENT_SDK: AGENT_SDK,
  };
  if (group.folder === 'critic') {
    containerEnv.GIT_AUTHOR_NAME = 'critic';
    containerEnv.GIT_AUTHOR_EMAIL = 'critic@nanoclaw';
    containerEnv.GIT_COMMITTER_NAME = 'critic';
    containerEnv.GIT_COMMITTER_EMAIL = 'critic@nanoclaw';
  }
  const containerArgs = buildContainerArgs(mounts, containerName, containerEnv);
```

`buildContainerArgs` must accept an `extraEnv?: Record<string, string>` parameter and emit `-e KEY=VALUE` flags for each entry — that signature change is part of section 01 (multi-SDK env plumbing) but the critic logic above depends on it, so verify both sides land together.

### 6. Mount allowlist

The fork relies on a host-side allowlist outside the project root (so it cannot be tampered with from inside a container):

`~/.config/nanoclaw/mount-allowlist.json` — two allowed roots:
- `~/Documents/dev/dirtsignals` (or wherever the user keeps that workspace)
- `~/Documents/dev/claws/NanoClaw/groups/shared` (must be the absolute path on this machine)

The migrator should:
1. Verify the file exists; create it if missing.
2. Confirm both paths are absolute and point to real directories.
3. NOT mount this file into any container — the runner reads it from the host only.

Without this file the container runner will reject the additional-mount entries on the homie/worker/verifier `containerConfig`, and those groups will spin up without `dirtsignals` or `groups/shared` — which means `mc.ts` is unreachable and the orchestrator tick is a no-op.

## Risk notes

- **`src/db.ts` seed semantics may collide with upstream.** Upstream may grow its own auto-discovery for registered groups or seeded tasks; the `INSERT OR IGNORE` writes here will silently no-op if a colliding row already exists, which can hide a JID mismatch. After rebasing, query `registered_groups` and `scheduled_tasks` to confirm the critic row and the `heartbeat-5min` row exist with the expected values.
- **`container-runner.ts` conditionals are stringly-typed on `group.folder`.** The critic-mount logic and the GIT_AUTHOR env injection both branch on `group.folder === 'critic'`. If upstream ever moves group registry/identity to a stable id (UUID, JID-only) or renames the field, both blocks silently stop firing — there is no test that exercises critic mounts. Re-grep for `'critic'` after any upstream merge that touches the runner or types.
- **`mc.ts` is versioned with the AGENTS.md prose, not the host code.** The mission-control file layout (`tasks/<id>.md` shape, `lock.json` schema, activity log fields) is defined inside `mc.ts` and referenced verbatim by the four AGENTS.md files. Any change to `mc.ts` must be replayed alongside whatever AGENTS.md changes assume the new shape; treat them as a single migration unit.
- **`AGENT-SPIRIT.md` is non-negotiable.** Per the per-agent prose, critic is explicitly forbidden from editing the other groups' `AGENT-SPIRIT.md` files (only `AGENTS.md` and `prompt-metrics.json`). When updating the critic mounts or adding new auto-engineer affordances, preserve that constraint — granting critic write access to `AGENT-SPIRIT.md` would let the auto-engineer loop drift the agents away from their intended spirit.
- **The heartbeat JID is install-specific.** `dc:1468824513654423697` is hard-coded above; if migrating to a different Discord channel (or another channel type), update the `chat_jid` in `seedScheduledTasks` and the matching homie registered-group row before first boot.
- **Mount allowlist lives outside the repo.** It is a host prerequisite, not a tracked file. A fresh machine without `~/.config/nanoclaw/mount-allowlist.json` will silently produce orchestrators that cannot reach mission-control — failure is at the validate-mounts step, not at startup.
