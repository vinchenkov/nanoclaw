# spawn_agent IPC + authorization

## Intent
Groups need to delegate work cross-process: homie spawns worker, worker spawns verifier, and (in EVALUATE_MODE) worker/verifier spawn critic. Containers are namespace-isolated and cannot directly invoke each other, so the only safe channel is the existing IPC task watcher on the host. The fork adds a new task type `spawn_agent` to `src/ipc.ts`, gates it behind a hardcoded authorization matrix, and routes accepted spawns through `GroupQueue` so the global concurrency limit and per-group serialization still apply. A `hasActiveOrPending` guard prevents double-dispatching to a target that is already running or queued.

## Files touched
- `src/ipc.ts` — `IpcDeps.spawnAgent`, new `group_folder` field on the task payload, `spawn_agent` case with auth matrix.
- `src/index.ts` — `spawnAgent` callback wired into `startIpcWatcher` deps; uses `runAgent` with `{ isolated }` and an idle/close timer.
- `src/group-queue.ts` — `hasActiveOrPending(groupJid)` predicate.

## How to apply

### 1. New IPC task type in src/ipc.ts

Extend `IpcDeps` with the `spawnAgent` callback:

```ts
export interface IpcDeps {
  // ...existing fields...
  spawnAgent: (
    targetFolder: string,
    prompt: string,
    contextMode: 'isolated' | 'group',
  ) => void;
}
```

Add `group_folder` to the task payload union (alongside the existing `groupFolder`):

```ts
schedule_value?: string;
context_mode?: string;
groupFolder?: string;
group_folder?: string;
chatJid?: string;
targetJid?: string;
```

Then add the `spawn_agent` case to the `switch` in `processTaskIpc` (verbatim — this is the spec):

```ts
case 'spawn_agent': {
  if (!data.group_folder || !data.prompt) {
    logger.warn(
      { sourceGroup, data },
      'spawn_agent missing required fields',
    );
    break;
  }

  const targetFolder = data.group_folder as string;

  // Validate target folder exists in registered groups
  const targetEntry = Object.entries(registeredGroups).find(
    ([_, g]) => g.folder === targetFolder,
  );

  // Authorization: non-main can spawn itself, the main group, or allowed cross-spawns
  const ALLOWED_CROSS_SPAWNS = new Set([
    'worker:verifier',
    'verifier:worker',
    'worker:critic', // critic evaluation
    'verifier:critic', // critic evaluation
  ]);

  if (!isMain && targetFolder !== sourceGroup) {
    const targetIsMain = targetEntry && targetEntry[1].isMain;
    const crossKey = `${sourceGroup}:${targetFolder}`;
    if (!targetIsMain && !ALLOWED_CROSS_SPAWNS.has(crossKey)) {
      logger.warn(
        { sourceGroup, targetFolder },
        'Unauthorized spawn_agent attempt blocked',
      );
      break;
    }
  }
  if (!targetEntry) {
    logger.warn(
      { targetFolder },
      'spawn_agent: target group not registered',
    );
    break;
  }

  const contextMode = data.context_mode === 'group' ? 'group' : 'isolated';

  deps.spawnAgent(targetFolder, data.prompt, contextMode);
  logger.info(
    { sourceGroup, targetFolder, contextMode },
    'spawn_agent processed',
  );
  break;
}
```

Note the order: missing-field check first, then auth check, then existence check, then dispatch. `sourceGroup` and `isMain` are derived earlier in `processTaskIpc` from the IPC directory path (never trusted from payload — that's the existing security model).

### 2. Authorization matrix

The matrix lives inline in the `spawn_agent` case in `src/ipc.ts`. Rules, in evaluation order:

1. **Main group can spawn anyone.** If `isMain` is true (source is homie), the auth block is skipped entirely.
2. **Self-spawn is allowed.** `targetFolder === sourceGroup` short-circuits the auth check (a group can re-spawn itself, e.g. for loop continuation).
3. **Any non-main group can spawn the main group.** `targetIsMain` short-circuits — workers/verifiers/critic can always escalate up to homie.
4. **Allowlisted cross-spawns** (verbatim, `ALLOWED_CROSS_SPAWNS`):
   - `worker:verifier`
   - `verifier:worker`
   - `worker:critic`
   - `verifier:critic`
5. **Everything else is blocked** with a `logger.warn('Unauthorized spawn_agent attempt blocked')`.

Implications:
- Critic cannot spawn anyone (it has no entries as a source). Critic is a leaf evaluator.
- Worker and verifier can spawn each other (revision loop) and can both spawn critic (evaluation in `EVALUATE_MODE`).
- The matrix is a `Set<string>` of `${source}:${target}` keys — keep that exact format if you extend it.

### 3. spawnAgent dep wiring in src/index.ts

The callback is added to the deps object passed to `startIpcWatcher`:

```ts
spawnAgent: (targetFolder, prompt, contextMode) => {
  const entry = Object.entries(registeredGroups).find(
    ([_, g]) => g.folder === targetFolder,
  );
  if (!entry) return;
  const [targetJid, group] = entry;

  if (queue.hasActiveOrPending(targetJid)) {
    logger.debug(
      { targetFolder },
      'spawn_agent skipped: target already active or queued',
    );
    return;
  }

  const taskId = `spawn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue.enqueueTask(targetJid, taskId, async () => {
    const SPAWN_CLOSE_DELAY_MS = 10_000;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleClose = () => {
      if (closeTimer) return;
      closeTimer = setTimeout(() => {
        queue.closeStdin(targetJid);
      }, SPAWN_CLOSE_DELAY_MS);
    };
    await runAgent(
      group,
      prompt,
      targetJid,
      async (output) => {
        if (output.status === 'success') {
          scheduleClose();
          queue.notifyIdle(targetJid);
        }
      },
      { isolated: contextMode === 'isolated' },
    );
    if (closeTimer) clearTimeout(closeTimer);
  });
},
```

Key details:
- Resolves `targetFolder` → `targetJid` via `registeredGroups`. If unregistered, silently returns (the IPC layer already logged).
- `hasActiveOrPending` short-circuits to avoid stacking spawn tasks on the same group.
- Dispatch goes through `queue.enqueueTask` so it respects `MAX_CONCURRENT_CONTAINERS` and per-group serialization — the same path scheduled tasks use.
- `runAgent` is called with `{ isolated: contextMode === 'isolated' }`, which suppresses session id reuse/persistence (see `runAgent` change in section 02).
- After a successful run the stdin is closed on a 10s delay (`SPAWN_CLOSE_DELAY_MS`) so the container can drain follow-up IPC messages before being torn down. `queue.notifyIdle` is also called so the queue can free the slot for the next pending task.

### 4. hasActiveOrPending guard in GroupQueue

Add to `src/group-queue.ts`:

```ts
hasActiveOrPending(groupJid: string): boolean {
  const state = this.groups.get(groupJid);
  if (!state) return false;
  return state.active || state.pendingTasks.length > 0;
}
```

It checks the per-group state map for either an in-flight container (`active`) or queued task entries (`pendingTasks.length > 0`). Used only by the spawn dispatch in `src/index.ts`; existing callers are unaffected.

## Risk notes
- **Upstream collision.** If upstream NanoClaw adds its own delegation primitive (e.g. a different IPC task type or a built-in subagent dispatch), both systems will fight for the target group's queue slot. Prefer to keep the auth matrix and dispatch under our wrapper and rebase upstream's primitive into a no-op or a complementary path.
- **Hardcoded matrix.** `ALLOWED_CROSS_SPAWNS` uses literal folder names (`worker`, `verifier`, `critic`). Renaming any of those folders, or introducing additional roles, requires editing the Set in `src/ipc.ts`. There is no dynamic lookup — keep this in mind when restructuring groups.
- **contextMode semantics.** `'isolated'` skips both reading and writing `sessions[group.folder]` in `runAgent` (see section 02 for the `seedScheduledTasks` + `runAgent` `{ isolated }` change). `'group'` reuses/persists the session id like a normal channel-driven run. After upgrading upstream, re-verify that `runAgent` still threads `options.isolated` through `setSession`/`getAllSessions(AGENT_SDK)` correctly — if upstream refactors session storage (e.g. removes the per-SDK key), `'isolated'` may silently start sharing context with `'group'` runs.
- **Idle/close timing.** The 10s `SPAWN_CLOSE_DELAY_MS` is empirical — it gives the spawned agent a window to drop follow-up IPC messages back to its parent before stdin closes. If upstream changes how containers drain stdin or how `notifyIdle`/`closeStdin` interact, re-verify that spawn-driven runs don't exit before they finish writing IPC.
- **Field name drift.** The payload accepts `group_folder` (snake_case) for `spawn_agent` while the rest of the IPC API uses `groupFolder` (camelCase). Both are declared in the union for compatibility; if upstream standardizes one form, update both call sites and the agent-side helpers that emit the JSON.
