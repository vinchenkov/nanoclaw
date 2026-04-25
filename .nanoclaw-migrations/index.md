# NanoClaw Migration Guide

Generated: 2026-04-24T21:23:49-0700
Base: `298c3eade4a8497264844aa29e71bee7dadf3a89`
HEAD at generation: `f710f5472b021ef2011e0cde522cd3bb967e73b4`
Upstream HEAD at generation: `8d8522202a0604d187f9da132c59f386e3c489a9`
Tier: 3 (directory-based)

## What this fork is

A heavy NanoClaw fork that builds a multi-agent system on top of the base:

- **Multi-SDK runtime** — agents run on either the Claude Agent SDK or the OpenAI Codex SDK, selected by `AGENT_SDK` env var.
- **Multi-agent groups** — `homie` (orchestrator, Discord-facing) → `worker` (executor) → `verifier` (output review). `critic` reviews adherence when `EVALUATE_MODE=true`.
- **Mission-control** — shared state plane at `groups/shared/mission-control/`, accessed via the `mc.ts` CLI; web dashboard on port 4377.
- **Discord channel** — primary channel via `discord.js`. No WhatsApp.
- **Tightened container isolation** — main agent no longer mounts the project root; critic gets elevated mounts to read group state and commit prompt edits.

## Substantive footprint

~48 files, not the 249 the raw diff shows. The other 201 are mostly agent-generated runtime state that got tracked, plus tests/lockfiles/specs.

| Bucket | Count |
|---|---|
| Substantive source/config | 31 |
| Net-new infra (groups/, shared/bin/) | 17 |
| Skill content (self-referential) | 4 |
| Generated agent state — disposable | 137 |
| Specs/docs | 7 |
| Tests | 15 |
| Lockfiles | 2 |

## Migration plan

1. Start from clean upstream worktree.
2. Hard-overwrite `.claude/skills/` from upstream and re-apply only the skills this install actually uses (`add-discord`). See `08-skills.md` — the fork has no custom skill content to preserve.
3. Apply architectural sections in this order:
   1. `07-config-and-env.md` — flags + env + secrets that everything else depends on.
   2. `01-multi-sdk-runtime.md` — db schema, runtime-registry, container-runner + agent-runner refactor.
   3. `02-multi-agent-groups.md` — homie/worker/verifier/critic groups + mission-control bin + seed functions.
   4. `03-spawn-agent-ipc.md` — IPC delegation between groups.
   5. `04-evaluate-mode.md` — critic injection.
   6. `05-discord-channel.md` — discord.js integration.
   7. `06-container-security.md` — mount tightening.
4. Copy net-new infra verbatim:
   - `groups/{homie,worker,verifier,critic}/AGENTS.md` (+ `AGENT-SPIRIT.md` for homie/worker/verifier; + `CLAUDE.md` symlinks).
   - `groups/global/AGENTS.md` and `CLAUDE.md`, `groups/main/CLAUDE.md` if present.
   - `groups/shared/bin/mc.ts`, `groups/shared/bin/dashboard-server.mjs`.
   - `scripts/{startclaw.sh, killclaw.sh, clear-history.sh, shell-critic.sh, seed-bread-baker.js}` if you want them.
5. `npm install && npm run build && npm test`.
6. Live smoke test before swap.

## Sections

- [01-multi-sdk-runtime.md](./01-multi-sdk-runtime.md) — Claude+Codex dispatch, db schema, runtime-registry
- [02-multi-agent-groups.md](./02-multi-agent-groups.md) — homie/worker/verifier/critic, mission-control, seed functions
- [03-spawn-agent-ipc.md](./03-spawn-agent-ipc.md) — IPC delegation + authorization matrix
- [04-evaluate-mode.md](./04-evaluate-mode.md) — critic injection
- [05-discord-channel.md](./05-discord-channel.md) — discord.js integration
- [06-container-security.md](./06-container-security.md) — mount tightening
- [07-config-and-env.md](./07-config-and-env.md) — config flags, env vars, secrets
- [08-skills.md](./08-skills.md) — skills reapply plan

## Disposable files (NOT migrated)

These are runtime artifacts that the current fork has tracked. Don't carry them over:

- `groups/shared/mission-control/**` — tasks, initiatives, outputs, revisions, activity logs, lock state.
- `groups/*/briefings/*` — daily briefings (agent-written).
- `groups/critic/critiques/*` — critic outputs.
- `groups/*/prompt-metrics.json` — already in fork's `.gitignore` but tracked anyway via earlier commits.
- `groups/state/**` — runtime state.

Optional carry-over: `specs/*.md` (design docs the user wrote — keep if useful, not load-bearing).

## Highest-risk areas (875 upstream commits of drift)

- **`src/db.ts`** — sessions table schema migration (composite PK). Reconcile against any upstream sessions-table changes.
- **`src/container-runner.ts`** — modified by fork for multi-SDK + critic mounts + security tightening. Almost certainly modified by upstream too.
- **`src/index.ts`** — orchestrator main loop has 875 commits of upstream evolution; fork wires `spawnAgent`, seed calls, and evaluate-mode injection into it.
- **`container/agent-runner/src/index.ts`** — fork split monolithic runner into dispatcher + claude/codex/shared. Upstream may have refactored differently.
- **`Channel` interface in `src/types.ts`** — discord.ts must compile against the current shape.
