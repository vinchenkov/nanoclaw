# Multi-SDK runtime (Claude + Codex)

## Intent

The fork lets the host operator pick which agent SDK runs inside containers — Claude Agent SDK or OpenAI Codex SDK — by setting `AGENT_SDK=claude|codex` in `.env`. Both SDKs must coexist on disk (sessions, auth, MCP servers, container source) so an operator can flip between them without losing per-group history. The chosen SDK is selected once at host startup and threaded through to every container spawn; the in-container runner then dispatches to an SDK-specific implementation.

## Files touched

src/

- `src/config.ts` (modified) — adds `AGENT_SDK` and `CODEX_MODEL` exports
- `src/runtime-registry.ts` (net-new) — per-SDK host-side `prepareHostState` hooks
- `src/db.ts` (modified) — sessions table gets composite PK `(group_folder, sdk)` plus a runtime migration
- `src/container-runner.ts` (modified) — Codex mount, secrets list extension, `NANOCLAW_AGENT_SDK` env injection, `runtime.prepareHostState` call, env-vars plumbing in `buildContainerArgs`
- `src/index.ts` (modified) — `getAllSessions(AGENT_SDK)`, `setSession(folder, AGENT_SDK, id)`, `agentSdk` in container input
- `src/task-scheduler.ts` (modified) — `agentSdk: AGENT_SDK` in scheduled-task container input

container/agent-runner/

- `container/agent-runner/src/index.ts` (modified, now a dispatcher) — reads `agentSdk` from input and routes to `runClaudeAgent` or `runCodexAgent`
- `container/agent-runner/src/shared.ts` (net-new) — shared types (`ContainerInput`, `ContainerOutput`, `SessionMetadata`), IPC helpers (`drainIpcInput`, `waitForIpcMessage`, `shouldClose`), output sentinels, stdin reader
- `container/agent-runner/src/runner-claude.ts` (net-new) — Claude SDK query loop
- `container/agent-runner/src/runner-codex.ts` (net-new) — Codex SDK query loop
- `container/agent-runner/package.json` (modified) — adds `@openai/codex-sdk`

container/

- `container/Dockerfile` (modified) — installs `@openai/codex` plus MCP servers (`@modelcontextprotocol/server-brave-search`, `firecrawl-mcp`); pre-creates `/home/node/.codex/sessions`

setup/

- `setup/codex-auth.ts` (net-new) — `codex login` OAuth flow or `--with-api-key` stdin entry; writes `data/codex-auth/auth.json`
- `setup/index.ts` (modified) — registers the `codex-auth` step

## How to apply

### 1. Config keys (`src/config.ts`)

Standard change. Extend the `readEnvFile([...])` allowlist with `'AGENT_SDK'` and `'CODEX_MODEL'`, then export:

```ts
export const AGENT_SDK: 'claude' | 'codex' = (process.env.AGENT_SDK ||
  envConfig.AGENT_SDK ||
  'claude') as 'claude' | 'codex';
export const CODEX_MODEL: string | undefined =
  process.env.CODEX_MODEL || envConfig.CODEX_MODEL || undefined;
```

`OPENAI_BASE_URL`, `CODEX_API_KEY`, `BRAVE_API_KEY`, `FIRECRAWL_API_KEY` are secrets and stay out of `config.ts` — they are read from `.env` only inside `container-runner.ts` via `readSecrets()`.

### 2. Sessions schema migration (`src/db.ts`)

Non-standard. The pre-existing `sessions` table had `group_folder TEXT PRIMARY KEY`. Each group must now hold a separate row per SDK so flipping `AGENT_SDK` does not stomp the other SDK's session id.

In `createSchema`, change the `CREATE TABLE IF NOT EXISTS sessions` to:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  group_folder TEXT NOT NULL,
  sdk TEXT NOT NULL DEFAULT 'claude',
  session_id TEXT NOT NULL,
  PRIMARY KEY (group_folder, sdk)
);
```

Then, *after* the existing column-add migrations and *inside the same `createSchema` body*, append the new-table migration block. SQLite cannot alter a primary key in place, so the migration is: add the column (no-op if already there), build a `sessions_new` with the composite PK, copy, swap. Wrap in `try/catch` so re-runs are idempotent.

```ts
// Migrate sessions table to composite PK (group_folder, sdk)
try {
  database.exec(
    `ALTER TABLE sessions ADD COLUMN sdk TEXT NOT NULL DEFAULT 'claude'`,
  );
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

The `ALTER TABLE` is what trips on re-run after a successful migration — that's the intended trigger to skip the rest. Do not change this to a more discriminating check; the swallow-all `catch` is the migration's idempotency guard.

Update the three accessor signatures so callers can pick a session per SDK:

```ts
export function getSession(
  groupFolder: string,
  sdk: string = 'claude',
): string | undefined {
  const row = db
    .prepare(
      'SELECT session_id FROM sessions WHERE group_folder = ? AND sdk = ?',
    )
    .get(groupFolder, sdk) as { session_id: string } | undefined;
  return row?.session_id;
}

export function setSession(
  groupFolder: string,
  sdk: string,
  sessionId: string,
): void {
  db.prepare(
    'INSERT OR REPLACE INTO sessions (group_folder, sdk, session_id) VALUES (?, ?, ?)',
  ).run(groupFolder, sdk, sessionId);
}

export function getAllSessions(sdk: string = 'claude'): Record<string, string> {
  const rows = db
    .prepare('SELECT group_folder, session_id FROM sessions WHERE sdk = ?')
    .all(sdk) as Array<{ group_folder: string; session_id: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.group_folder] = row.session_id;
  }
  return result;
}
```

`getSession` keeps its default of `'claude'` so any upstream call site that hasn't been ported still resolves. `setSession` deliberately has *no* default — callers must be explicit, otherwise a Codex run silently overwrites the Claude session row. If upstream has new internal callers of `setSession`, port them and pass the SDK explicitly.

In `migrateJsonState` (the legacy JSON → SQLite import), the call becomes:

```ts
setSession(folder, 'claude', sessionId);
```

(legacy state predates the multi-SDK split, so it's all Claude.)

### 3. Runtime registry (`src/runtime-registry.ts`)

Non-standard, net-new. The host needs a per-SDK pre-spawn hook so the Codex runtime can materialise `~/.codex` for the group (sessions dir, auth.json copy, `config.toml` from `CODEX_MODEL`) before the container starts. Claude needs nothing extra because its host state is already in `buildVolumeMounts`. Write the file verbatim:

```ts
import fs from 'fs';
import path from 'path';

import { CODEX_MODEL, DATA_DIR } from './config.js';
import { logger } from './logger.js';

export type RuntimeKind = 'claude' | 'codex';

export interface RuntimeHooks {
  prepareHostState(groupFolder: string): void;
}

const claudeRuntime: RuntimeHooks = {
  prepareHostState(_groupFolder: string): void {
    // Claude state is already handled in buildVolumeMounts
  },
};

const codexRuntime: RuntimeHooks = {
  prepareHostState(groupFolder: string): void {
    const groupCodexDir = path.join(
      DATA_DIR,
      'sessions',
      groupFolder,
      '.codex',
    );
    fs.mkdirSync(path.join(groupCodexDir, 'sessions'), { recursive: true });

    // Copy shared auth from data/codex-auth/auth.json if it exists
    const sharedAuth = path.join(DATA_DIR, 'codex-auth', 'auth.json');
    if (fs.existsSync(sharedAuth)) {
      const destAuth = path.join(groupCodexDir, 'auth.json');
      fs.copyFileSync(sharedAuth, destAuth);
    }

    // Generate config.toml if CODEX_MODEL is set
    if (CODEX_MODEL) {
      const configPath = path.join(groupCodexDir, 'config.toml');
      fs.writeFileSync(
        configPath,
        `model = "${CODEX_MODEL}"\nsandbox_mode = "danger-full-access"\n`,
      );
    }
  },
};

export function getRuntime(kind: RuntimeKind): RuntimeHooks {
  if (kind === 'codex') return codexRuntime;
  return claudeRuntime;
}
```

`auth.json` is copied (not symlinked or mounted) into each group's `.codex` dir at every spawn — this keeps the master copy at `data/codex-auth/auth.json` authoritative while letting each container have its own writable Codex home. `sandbox_mode = "danger-full-access"` is intentional: the container itself is the sandbox, so Codex's in-process restrictions just get in the way.

### 4. Container-runner wiring (`src/container-runner.ts`)

Several small edits to one file. Apply each:

a. Imports: add `AGENT_SDK` to the `./config.js` import group, and `import { getRuntime } from './runtime-registry.js';`.

b. `ContainerInput` interface: add `agentSdk?: 'claude' | 'codex';` next to `assistantName`.

c. Codex mount in `buildVolumeMounts` — add this right after the existing per-group `.claude` mount:

```ts
// Per-group Codex sessions directory (isolated from other groups)
const groupCodexDir = path.join(DATA_DIR, 'sessions', group.folder, '.codex');
fs.mkdirSync(path.join(groupCodexDir, 'sessions'), { recursive: true });
mounts.push({
  hostPath: groupCodexDir,
  containerPath: '/home/node/.codex',
  readonly: false,
});
```

The mount is unconditional (always mounted, regardless of `AGENT_SDK`). This is intentional so flipping the env var doesn't require a host-side reconfigure.

d. `readSecrets()` — extend the allowlist to include the Codex/MCP secrets:

```ts
return readEnvFile([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'BRAVE_API_KEY',
  'FIRECRAWL_API_KEY',
  'CODEX_API_KEY',
  'OPENAI_BASE_URL',
]);
```

e. `buildContainerArgs` — accept an optional `extraEnv` map and emit `-e KEY=VALUE` flags:

```ts
function buildContainerArgs(
  mounts: VolumeMount[],
  containerName: string,
  extraEnv?: Record<string, string>,
): string[] {
  const args: string[] = ['run', '-i', '--rm', '--name', containerName];
  args.push('-e', `TZ=${TIMEZONE}`);
  if (extraEnv) {
    for (const [key, value] of Object.entries(extraEnv)) {
      args.push('-e', `${key}=${value}`);
    }
  }
  // ... rest unchanged (uid mapping, mounts, image)
}
```

f. In `runContainerAgent`, after `fs.mkdirSync(groupDir, { recursive: true });` and before `buildVolumeMounts`, call the runtime hook and pass `NANOCLAW_AGENT_SDK` via `extraEnv`:

```ts
const runtime = getRuntime(AGENT_SDK);
runtime.prepareHostState(group.folder);

const mounts = buildVolumeMounts(group, input.isMain);
const safeName = group.folder.replace(/[^a-zA-Z0-9-]/g, '-');
const containerName = `nanoclaw-${safeName}-${Date.now()}`;
const containerEnv: Record<string, string> = {
  NANOCLAW_AGENT_SDK: AGENT_SDK,
};
const containerArgs = buildContainerArgs(mounts, containerName, containerEnv);
```

`NANOCLAW_AGENT_SDK` is non-secret and serves as a sanity check inside the container; the authoritative dispatch signal is `agentSdk` in the stdin JSON.

### 5. Threading `AGENT_SDK` through callers (`src/index.ts`, `src/task-scheduler.ts`)

Standard plumbing. Wherever `runContainerAgent` is invoked, add `agentSdk: AGENT_SDK` to the `ContainerInput` literal. Wherever sessions are read, pass the SDK:

In `src/index.ts`:
- `loadState`: `sessions = getAllSessions(AGENT_SDK);`
- `runAgent` callbacks that persist a new session id: `setSession(group.folder, AGENT_SDK, output.newSessionId);`
- `runAgent` container input: include `agentSdk: AGENT_SDK`

In `src/task-scheduler.ts`:
- Container input for scheduled tasks: include `agentSdk: AGENT_SDK`

Import `AGENT_SDK` from `./config.js` in both files.

### 6. Agent-runner split (`container/agent-runner/src/`)

Non-standard. The previous monolithic `index.ts` is replaced by four files. The dispatcher (`index.ts`) only parses stdin and routes. SDK-specific query loops, MCP setup, IPC turn handling, and session-id capture all move into `runner-claude.ts` / `runner-codex.ts`. Common helpers move into `shared.ts`.

Both runners share the same outer protocol: read `ContainerInput` from stdin once, then run a turn loop where each turn either consumes a fresh prompt or blocks on `waitForIpcMessage()`, emitting each result wrapped in `OUTPUT_START_MARKER` / `OUTPUT_END_MARKER`. The dispatcher never sees the loop — each runner owns it.

a. Write `container/agent-runner/src/shared.ts` verbatim. Key exports any caller depends on:

```ts
export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  agentSdk?: 'claude' | 'codex';
  secrets?: Record<string, string>;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export interface SessionMetadata {
  sdk: 'claude' | 'codex';
  group: string;
  sessionId: string;
  tracePath: string;
}

export const IPC_INPUT_DIR = '/workspace/ipc/input';
export const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
export const IPC_POLL_MS = 500;
export const SESSION_METADATA_PATH = '/tmp/nanoclaw-session.json';
export const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
export const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';
```

Plus helpers: `writeOutput(output)`, `log(msg)`, `clearSessionMetadata()`, `writeSessionMetadata(meta)`, `readStdin()`, `shouldClose()`, `drainIpcInput()`, `waitForIpcMessage()`. The full bodies are in the source — they are mechanical (fs polling, sentinel checks, marker writes). Keep the marker strings character-for-character identical to the host parser in `src/container-runner.ts`.

b. Replace `container/agent-runner/src/index.ts` with the dispatcher:

```ts
import fs from 'fs';

import { ContainerInput, log, readStdin, writeOutput } from './shared.js';
import { runClaudeAgent } from './runner-claude.js';
import { runCodexAgent } from './runner-codex.js';

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try {
      fs.unlinkSync('/tmp/input.json');
    } catch {
      /* may not exist */
    }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }

  const sdk = containerInput.agentSdk || 'claude';
  log(`Agent SDK: ${sdk}, group: ${containerInput.groupFolder}`);

  try {
    if (sdk === 'codex') {
      await runCodexAgent(containerInput, sdkEnv);
    } else {
      await runClaudeAgent(containerInput, sdkEnv);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
```

Two non-obvious details:

- The dispatcher merges `containerInput.secrets` into a *local* `sdkEnv` map and passes that to the runner — never into `process.env`. Both runners must accept this map and pass it to whichever child process needs it (e.g. when spawning MCP servers). Bash subprocesses spawned by the agent only see `process.env`, so secrets stay out of `bash -c` invocations.
- `/tmp/input.json` is the file the container entrypoint writes (in `container/Dockerfile`) before piping to node. Deleting it first thing is a defence-in-depth move so the file does not outlive the parse.

c. Write `runner-claude.ts` and `runner-codex.ts`. Each exports `async function runClaudeAgent(input, sdkEnv)` / `async function runCodexAgent(input, sdkEnv)`. Each is an SDK-specific implementation of the same outer turn protocol described above. Both runners must:

- Accept a `ContainerInput` and the `sdkEnv` env map
- Resume from `input.sessionId` if present (Claude: pass to `query({ resume })`; Codex: pass to `client.resumeThread`/equivalent SDK call)
- Emit each turn's result with `writeOutput({ status, result, newSessionId })`
- After each successful turn, call `writeSessionMetadata({ sdk, group, sessionId, tracePath })` so subject agents can spawn critic with the correct trace path
- After each successful turn, call `waitForIpcMessage()` — if it returns a string, that's the next user turn; if it returns `null`, the host wrote `_close` and the runner exits

Read the live `runner-claude.ts` / `runner-codex.ts` for the SDK-specific calls; the structure is the same in both.

### 7. Agent-runner package (`container/agent-runner/package.json`)

Standard. Add to `dependencies`:

```json
"@openai/codex-sdk": "^0.113.0"
```

(Keep `@anthropic-ai/claude-agent-sdk`, `@modelcontextprotocol/sdk`, `cron-parser`, `zod`.)

### 8. Container image (`container/Dockerfile`)

Standard. Replace the line that installs `agent-browser @anthropic-ai/claude-code` with:

```dockerfile
RUN npm install -g agent-browser @anthropic-ai/claude-code @openai/codex \
    @modelcontextprotocol/server-brave-search@0.6.2 \
    firecrawl-mcp@3.10.3
```

And extend the workspace-creation `mkdir -p` to include `/home/node/.codex/sessions`:

```dockerfile
RUN mkdir -p /workspace/group /workspace/global /workspace/extra /workspace/ipc/messages /workspace/ipc/tasks /workspace/ipc/input /home/node/.codex/sessions
```

Pin the MCP server versions exactly as shown — newer majors of either package have changed CLI flags. `@openai/codex` is the CLI used by `setup/codex-auth.ts` for OAuth login, but it also ships the runtime that the codex SDK shells out to inside the container, so it must be globally installed.

After editing, rebuild with `./container/build.sh`. Note that `--no-cache` alone does *not* invalidate the COPY steps; if you hit stale-context issues, prune the buildkit builder.

### 9. Codex auth setup (`setup/codex-auth.ts` + `setup/index.ts`)

Non-standard, net-new step. Two modes:

- Default: runs `codex login` (browser OAuth), then copies `~/.codex/auth.json` to `data/codex-auth/auth.json` with mode `0600`. The runtime registry copies this file into each group's `.codex/` dir at every container spawn.
- `--with-api-key`: prompts on stdin for an OpenAI API key (must start with `sk-`), then writes/replaces `CODEX_API_KEY=...` in `.env`. The key flows to containers as a stdin-passed secret via `readSecrets()` — never written into the container image.

Write `setup/codex-auth.ts` verbatim from the source. Two notes for re-application:

- The OAuth path expects `auth.json` at `~/.codex/auth.json` after `codex login`. On some systems Codex CLI stores the credentials in the system keychain instead; if that happens, the script exits with an error and recommends `--with-api-key`.
- `emitStatus('CODEX_AUTH', { ... })` calls into the existing setup status helper. If that helper's signature has drifted upstream, adjust the two calls accordingly — this is a status-broadcast for the setup UI, not load-bearing.

Register the step in `setup/index.ts` by adding one entry to the `STEPS` map, between `container` and `groups`:

```ts
'codex-auth': () => import('./codex-auth.js'),
```

Run with `npx tsx setup/index.ts --step codex-auth` (OAuth) or `--step codex-auth --with-api-key`.

## Risk notes

- `src/db.ts` schema migration: 875 commits of upstream drift may have added unrelated columns to `sessions`, or may have introduced its own multi-SDK / multi-tenancy migration. The `try/catch`-around-`ALTER TABLE` is the only re-run guard — if upstream has already migrated the column shape, ours becomes a no-op (good), but if upstream renamed the table or split it, the `INSERT INTO sessions_new SELECT group_folder, sdk, session_id FROM sessions` will fail silently and leave the original table untouched. Before applying, dump the current `sessions` schema with `sqlite3 store/<db>.sqlite ".schema sessions"` and reconcile column names by hand.
- `src/db.ts` accessor signatures: any new upstream caller of `setSession(folder, id)` (two-argument form) will silently break — TypeScript will catch it, but a JS-side caller (e.g. a script in `scripts/`) won't. Search for all `setSession(` and `getAllSessions(` call sites after applying.
- `src/container-runner.ts` mount conventions: this section also touches the mount block. Section 06 describes the security tightening (main no longer gets `/workspace/project`) and section 02 describes the critic-specific mounts. Apply the section ordering carefully — the unconditional-Codex-mount edit here belongs between the existing `.claude` mount and the IPC mount; if upstream has reorganised that block, reanchor by searching for the `groupClaudeDir` mount.
- `container/agent-runner/` monolithic-vs-split: if upstream has continued evolving the monolithic `index.ts` (added new MCP wiring, new IPC message types, new output kinds), the split forces a manual port — every upstream change has to be applied to whichever sibling owns that responsibility (`runner-claude.ts` for Claude-specific behaviour, `shared.ts` for protocol/IPC, both runners for cross-cutting changes). Before applying, diff the upstream `index.ts` against the BASE merge-base and decide per-hunk where each upstream change lands.
- `container/Dockerfile` MCP version pins: `@modelcontextprotocol/server-brave-search@0.6.2` and `firecrawl-mcp@3.10.3` are exact versions for a reason. If a newer upstream Dockerfile pins different versions of these (or removes them), prefer the upstream pin only if you've separately verified the new flags match what `runner-codex.ts` invokes.
- `setup/index.ts` STEPS map: if upstream has reordered or restructured the setup steps (e.g. replaced the import-map with a discovery scheme), insert `codex-auth` into whatever the equivalent registry is. The step itself is self-contained and does not depend on other setup-step internals beyond `emitStatus`.
- `OPENAI_BASE_URL` secret: it is treated as a secret (passed via stdin) rather than a config export. If you are using a custom OpenAI-compatible base URL (e.g. for a proxy), it must live in `.env` and be added to `readSecrets()`'s allowlist — not in `config.ts`'s `readEnvFile([])`.
