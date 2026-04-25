# Container mount security tightening

## Intent

Reduce the blast radius of a misbehaving main agent. At BASE, the main group container received the entire project root mounted read-only at `/workspace/project`, which meant the orchestrator could browse all source code, configs, and (without the `/dev/null` shadow) `.env`. The fork removes that mount entirely so secrets and host source are unreachable from inside the main container.

Constraint: main still needs read-write access to its own group folder and read-write access to `groups/global/` (shared memory). Non-main groups still get `groups/global/` but read-only. Secrets continue to flow exclusively via stdin (`readSecrets()`), never via mounted files.

## Files touched

- `src/container-runner.ts` — `buildVolumeMounts(group, isMain)`

## How to apply

### 1. Remove project-root mount for main

At BASE, `buildVolumeMounts` had a top-level `if (isMain) { ... } else { ... }` split. The `if` branch mounted the project root and the `/dev/null` shadow of `.env`; the `else` branch mounted the group folder and global. The fork collapses both branches: every group gets its own folder, and `globalDir` is mounted for everyone (writable for main, read-only otherwise).

BASE-era block to locate and delete (recognize this on the fresh upstream worktree even if surrounding code has shifted):

```ts
if (isMain) {
  // Main gets the project root read-only. Writable paths the agent needs
  // (group folder, IPC, .claude/) are mounted separately below.
  // Read-only prevents the agent from modifying host application code
  // (src/, dist/, package.json, etc.) which would bypass the sandbox
  // entirely on next restart.
  mounts.push({
    hostPath: projectRoot,
    containerPath: '/workspace/project',
    readonly: true,
  });

  // Shadow .env so the agent cannot read secrets from the mounted project root.
  // Secrets are passed via stdin instead (see readSecrets()).
  const envFile = path.join(projectRoot, '.env');
  if (fs.existsSync(envFile)) {
    mounts.push({
      hostPath: '/dev/null',
      containerPath: '/workspace/project/.env',
      readonly: true,
    });
  }

  // Main also gets its group folder as the working directory
  mounts.push({
    hostPath: groupDir,
    containerPath: '/workspace/group',
    readonly: false,
  });
} else {
  // Other groups only get their own folder
  mounts.push({
    hostPath: groupDir,
    containerPath: '/workspace/group',
    readonly: false,
  });

  // Global memory directory (read-only for non-main)
  // Only directory mounts are supported, not file mounts
  const globalDir = path.join(GROUPS_DIR, 'global');
  if (fs.existsSync(globalDir)) {
    mounts.push({
      hostPath: globalDir,
      containerPath: '/workspace/global',
      readonly: true,
    });
  }
}
```

Replace the entire `if (isMain) { ... } else { ... }` block above with the unified mounts:

```ts
// All groups get their own folder as the working directory
mounts.push({
  hostPath: groupDir,
  containerPath: '/workspace/group',
  readonly: false,
});

// Global memory directory (read-only for all groups)
const globalDir = path.join(GROUPS_DIR, 'global');
if (fs.existsSync(globalDir)) {
  mounts.push({
    hostPath: globalDir,
    containerPath: '/workspace/global',
    readonly: !isMain,
  });
}
```

After this, `projectRoot` is only used elsewhere in the function (e.g. resolving `agentRunnerSrc` paths and — per section 02 — the critic `.git` mount). It is no longer mounted into any non-critic container. The `/dev/null` shadow of `.env` is gone because nothing mounts the parent directory anymore.

### 2. Mount `/workspace/group` for all groups (was non-main only)

This is implicit in step 1 — the unified replacement block hoists the `groupDir → /workspace/group` push out of both branches so it runs for every group, main or not. Verify after editing that there is exactly one push targeting `/workspace/group` in `buildVolumeMounts`, and that `readonly: false` on it.

### 3. Cross-references

- Critic's elevated mounts (`groups/` rw, `data/sessions/` ro, `.git` rw) are added in a separate `if (group.folder === 'critic') { ... }` block lower in the same function. Covered in section **02** (critic group). This section deliberately leaves that block alone.
- Per-group `.codex` and `.claude` session mounts (the multi-SDK story) are covered in section **01**.
- Host-side mount allowlist file (`~/.config/nanoclaw/mount-allowlist.json`) gates `additionalMounts` via `validateAdditionalMounts()`. Not modified by this section, but referenced — it is the only path by which a group can mount anything outside the project tree.

## Risk notes

- **HIGH**: 875 upstream commits likely refactored `buildVolumeMounts` already. The "remove project-root mount" instruction may target code that no longer exists or has been split into multiple functions. Re-read the upstream version of `src/container-runner.ts` before applying — search for any `containerPath: '/workspace/project'` and any `'/dev/null'` mount; if neither exists, upstream has already done this work.
- If upstream has already removed the project-root mount in some other form (e.g. via a capability flag or per-group config), this section is partially obsolete. Migrator should run `git diff upstream/main -- src/container-runner.ts` against the BASE commit `298c3eade4a8497264844aa29e71bee7dadf3a89` before applying, and skip step 1 if the project-root mount is already gone.
- **Behavior change**: any agent prompt or skill that referenced `/workspace/project` will silently fail (path no longer exists in main container). Audit all `groups/*/AGENTS.md`, `groups/*/CLAUDE.md`, and any custom skills under `container/skills/` for `/workspace/project` references. The orchestrator (`homie`) is the most likely offender since it was the only group with that mount.
- The main group can now write to `groups/global/` (was read-only at BASE for non-main, not mounted at all for main). If your `groups/global/` contains anything that should be protected from main, move it elsewhere or add a more granular mount.
