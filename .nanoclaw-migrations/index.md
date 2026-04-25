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
7. **Reconcile `MY-UNDERSTANDING.md`** — see "Mental model reconciliation" below.

## Sections

- [01-multi-sdk-runtime.md](./01-multi-sdk-runtime.md) — Claude+Codex dispatch, db schema, runtime-registry
- [02-multi-agent-groups.md](./02-multi-agent-groups.md) — homie/worker/verifier/critic, mission-control, seed functions
- [03-spawn-agent-ipc.md](./03-spawn-agent-ipc.md) — IPC delegation + authorization matrix
- [04-evaluate-mode.md](./04-evaluate-mode.md) — critic injection
- [05-discord-channel.md](./05-discord-channel.md) — discord.js integration
- [06-container-security.md](./06-container-security.md) — mount tightening
- [07-config-and-env.md](./07-config-and-env.md) — config flags, env vars, secrets
- [08-skills.md](./08-skills.md) — skills reapply plan

## Mental model reconciliation

`MY-UNDERSTANDING.md` (in the project root) is the user's mental model of how this NanoClaw install works. The migration changes several things it asserts. After the architectural sections are applied and tests pass, **spawn a sub-agent** to read `MY-UNDERSTANDING.md` against the freshly-migrated codebase and update it. The user wants to be aware of big architectural or control shifts — the agent must surface these to the user, not just silently rewrite the file.

### Known impacts to reconcile

These are the sections of `MY-UNDERSTANDING.md` the migration is known to invalidate. The reconciling agent should verify each against the new codebase and update accordingly:

| `MY-UNDERSTANDING.md` section | Affected by | Change |
|---|---|---|
| Containers > Visible paths for a group (main) | section 06 | `/workspace/project/` mount is **removed** for main. Homie no longer sees the NanoClaw repo. |
| Containers > Visible paths for a group | section 01 | `/home/node/.codex/` mount appears alongside `/home/node/.claude/` when `AGENT_SDK=codex`. |
| Containers > Sessions | section 01 | Per-group `data/sessions/{group}/.codex/` exists alongside `.claude/`. Sessions table now keys on `(group_folder, sdk)` — flipping `AGENT_SDK` keeps the other SDK's session intact. |
| Containers > Secrets | section 07 | Adds `BRAVE_API_KEY`, `FIRECRAWL_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL` to the secrets read on host and passed via stdin. |
| Containers > Mount Validation | (verify) | The allowlist path may have shifted upstream; verify against current `src/mount-security.ts`. The fork uses `~/.config/nanoclaw/mount-allowlist.json`, not `config-examples/...`. |
| Containers > Life timeline | section 03 | New control path: agents can spawn other agents via `spawn_agent` IPC (with allowlisted pairs). Document the worker → verifier and main → any flows. |
| Tasks | section 02 | `seedRegisteredGroup` and `seedScheduledTasks` run at host startup — main is no longer the only seeded group; critic is also seeded. |
| Agent Meta Configurability | section 01 | The per-group `agent-runner-src/` copy still applies, but the source now contains the dispatcher + `runner-claude.ts` + `runner-codex.ts` + `shared.ts` instead of a monolithic `index.ts`. |

### Sections to add

- **Multi-SDK runtime** — `AGENT_SDK=claude|codex` selects the runtime at host startup; selection is threaded through to every container; per-SDK auth lives separately (`.claude/` vs `.codex/` per group).
- **Critic group** — out-of-band adherence reviewer. Has elevated mounts: `groups/` rw (can edit other groups' AGENTS.md), `data/sessions/` ro (can read other groups' transcripts), `.git` rw (can commit prompt edits with `GIT_AUTHOR_NAME=critic`). Active only when `EVALUATE_MODE=true`.
- **EVALUATE_MODE** — when on, every non-critic agent run gets an injected directive at the end of its prompt that spawns a critic to review adherence. Critique files land in `groups/critic/critiques/`.
- **spawn_agent IPC** — cross-group delegation primitive. Authorization matrix: main → any; self-spawn allowed; allowlisted pairs (worker↔verifier, worker→critic, verifier→critic). `contextMode: 'isolated' | 'group'` controls whether the spawned run reuses session id.

### How to invoke the reconciliation step

Before the swap (step 8 in the skill's Phase 2 — i.e. while still in the worktree), spawn an agent:

```
Read MY-UNDERSTANDING.md. For each section listed under "Known impacts" in
.nanoclaw-migrations/index.md, verify against the current codebase and update
the document. Add the new sections listed under "Sections to add". Then
produce a short summary for the user listing every architectural or
control-flow shift that's user-facing — e.g. "homie no longer sees project
root", "agents can now spawn other agents", "sessions are now per-SDK".
Surface this summary in the response, do not just silently rewrite the file.
```

The user explicitly asked to be made aware of big shifts, so the summary is mandatory.

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
