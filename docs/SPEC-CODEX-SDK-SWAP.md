# Codex SDK Swap — Implementation Spec

Config-driven SDK selection for NanoClaw. Flip `AGENT_SDK=claude|codex` in `.env` to switch which agentic SDK powers the container agents. Both SDKs are installed in the container image; a thin dispatcher selects the right runner at startup.

Delivered as a NanoClaw skill (`/add-codex-sdk`) following the project's "skills over features" philosophy.

## Goal

After running `/add-codex-sdk`, the user can switch between Claude Agent SDK and OpenAI Codex SDK by changing one line in `.env`:

```bash
AGENT_SDK=claude   # default — current behavior, unchanged
AGENT_SDK=codex    # uses ChatGPT Plus via OAuth token
```

No rebuild required to switch. The container image ships both SDKs. The dispatcher inside the container reads the config from the stdin JSON and delegates to the appropriate runner.

## Architecture

```
Current (single path):
  Container -> index.ts -> claude-agent-sdk -> query() -> Anthropic API

Proposed (config-driven):
  .env AGENT_SDK ─┐
                   v
  container-runner.ts reads AGENT_SDK, passes in ContainerInput.agentSdk
                   │
  Container -> index.ts (dispatcher)
                   ├─ agentSdk === 'claude' -> runner-claude.ts -> claude-agent-sdk -> query()
                   └─ agentSdk === 'codex'  -> runner-codex.ts  -> codex-sdk -> Codex CLI -> OpenAI API
```

Host-side flow is unchanged: spawn container, pass JSON via stdin, parse sentinel markers from stdout, IPC via filesystem. The dispatcher is transparent to the host.

## Session Compatibility Requirement

`sessionId` values are SDK-specific and not interchangeable:

- Claude session IDs are only valid for Claude Agent SDK resume.
- Codex thread IDs are only valid for Codex SDK thread retrieval.

NanoClaw currently stores one session ID per group. With dual SDK support, that would cause resume failures when switching `AGENT_SDK` (for example, Codex trying to retrieve a Claude session ID). Therefore, host-side session persistence must be SDK-scoped.

**Required behavior:**

- Persist sessions by `(group_folder, sdk)` instead of only `group_folder`.
- Read/write the session for the active SDK only.
- If no session exists for the active SDK, start a new session/thread (no cross-SDK resume attempt).

---

## Agent Runner Refactor

The current `container/agent-runner/src/index.ts` (603 lines) is a single file mixing SDK-specific and SDK-agnostic code. The refactor splits it into four files:

### File Decomposition

```
container/agent-runner/src/
  index.ts          # Dispatcher: read stdin, check agentSdk, delegate
  shared.ts         # SDK-agnostic: interfaces, IPC, sentinels, transcript archiving
  runner-claude.ts  # Claude Agent SDK runner (extracted from current index.ts)
  runner-codex.ts   # Codex SDK runner (new)
  ipc-mcp-stdio.ts  # Unchanged — MCP server for IPC
```

### shared.ts — SDK-Agnostic Code

Extracted verbatim from current `index.ts`. No behavior changes.

**Exports:**

```typescript
// Interfaces
export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
  agentSdk?: 'claude' | 'codex';  // NEW — dispatcher key
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export interface QueryResult {
  newSessionId?: string;
  lastAssistantUuid?: string;
  closedDuringQuery: boolean;
}

// Constants
export const OUTPUT_START_MARKER: string;
export const OUTPUT_END_MARKER: string;
export const IPC_INPUT_DIR: string;
export const IPC_INPUT_CLOSE_SENTINEL: string;
export const IPC_POLL_MS: number;

// Functions
export function writeOutput(output: ContainerOutput): void;
export function log(message: string): void;
export function readStdin(): Promise<string>;
export function shouldClose(): boolean;
export function drainIpcInput(): string[];
export function waitForIpcMessage(): Promise<string | null>;

// Transcript archiving
export function parseTranscript(content: string): ParsedMessage[];
export function formatTranscriptMarkdown(...): string;
export function sanitizeFilename(summary: string): string;
export function generateFallbackName(): string;
export function getSessionSummary(sessionId: string, transcriptPath: string): string | null;

// Extra directories discovery
export function discoverExtraDirs(): string[];

// CLAUDE.md / system prompt loading
export function loadSystemPrompts(): string | undefined;
```

New helper `discoverExtraDirs()` extracts lines 401-415 of current index.ts:

```typescript
export function discoverExtraDirs(): string[] {
  const extraDirs: string[] = [];
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }
  return extraDirs;
}
```

New helper `loadSystemPrompts()` reads CLAUDE.md files from group, global, and extra dirs — needed by Codex runner since it doesn't have Claude's `additionalDirectories` concept:

```typescript
export function loadSystemPrompts(): string | undefined {
  const parts: string[] = [];
  const paths = [
    '/workspace/group/CLAUDE.md',
    '/workspace/global/CLAUDE.md',
    ...discoverExtraDirs().map(d => path.join(d, 'CLAUDE.md')),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      parts.push(fs.readFileSync(p, 'utf-8'));
    }
  }
  return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
}
```

### index.ts — Dispatcher

Thin entrypoint. Reads stdin, dispatches to the right runner.

```typescript
import { readStdin, log, writeOutput } from './shared.js';
import { run as runClaude } from './runner-claude.js';
import { run as runCodex } from './runner-codex.js';
import type { ContainerInput } from './shared.js';
import fs from 'fs';

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try { fs.unlinkSync('/tmp/input.json'); } catch { /* may not exist */ }
    log(`Received input for group: ${containerInput.groupFolder}, sdk: ${containerInput.agentSdk || 'claude'}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  }

  const sdk = containerInput.agentSdk || 'claude';

  if (sdk === 'codex') {
    await runCodex(containerInput);
  } else {
    await runClaude(containerInput);
  }
}

main();
```

### runner-claude.ts — Claude Agent SDK (Extracted)

Extracted from current `index.ts` lines 19-601. Exports a single `run(input: ContainerInput)` function.

**What moves here:**
- `MessageStream` class (lines 66-96)
- `createPreCompactHook()` (lines 146-186)
- `createSanitizeBashHook()` (lines 193-210)
- `runQuery()` (lines 357-506)
- The main query loop from `main()` (lines 536-600)

**What it imports from shared.ts:**
- All interfaces, constants, IPC functions, transcript helpers

**SDK-specific imports:**
```typescript
import { query, HookCallback, PreCompactHookInput, PreToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';
```

**Signature:**
```typescript
export async function run(containerInput: ContainerInput): Promise<void>
```

This is a mechanical extraction. No behavior changes whatsoever.

### runner-codex.ts — Codex SDK (New)

Same contract as `runner-claude.ts`: exports `run(input: ContainerInput)`.

**SDK-specific imports:**
```typescript
import { Codex } from '@openai/codex-sdk';
```

**Key differences from Claude runner:**

| Concern | Claude Runner | Codex Runner |
|---------|--------------|--------------|
| SDK init | implicit via `query()` options | explicit `new Codex({...})` constructor |
| Session | `resume: sessionId` option | `codex.threads.retrieve(sessionId)` or `codex.threads.create()` |
| Streaming | `for await (const message of query({...}))` | `for await (const event of run.events)` |
| Follow-ups | `MessageStream` push into active query | New `thread.run()` call on same thread |
| System prompt | `systemPrompt` option + `additionalDirectories` | Manual: `loadSystemPrompts()` prepended to first prompt |
| MCP servers | SDK `mcpServers` option | Codex config `mcp_servers` object |
| Hooks (bash sanitize) | `PreToolUse` hook rewrites command | `env` option on Codex constructor — only safe vars passed |
| Hooks (transcript archive) | `PreCompact` hook reads transcript | Read Codex rollout file from `~/.codex/sessions/{id}/` on turn end |
| Tools allowed | `allowedTools` list | Codex has built-in tool set (shell, file ops, MCP) — no filtering needed |

**Event mapping:**

| Claude SDK Event | Codex SDK Event | Action |
|-----------------|-----------------|--------|
| `system/init` (message.session_id) | `thread.started` | Capture thread ID as newSessionId |
| `assistant` message | `item.completed` (type: `agent_message`) | Capture last response text |
| `result` | `turn.completed` | `writeOutput({ status: 'success', result, newSessionId })` |
| error | `turn.failed` | `writeOutput({ status: 'error', ... })` |
| `system/task_notification` | `item.completed` (type: `todo_list`) | Log only |

**Codex constructor:**
```typescript
const codex = new Codex({
  apiKey: containerInput.secrets?.CHATGPT_ACCESS_TOKEN,
  model: containerInput.secrets?.CHATGPT_MODEL || 'gpt-4o',
});
```

**Thread management:**
```typescript
// Resume or create thread
const thread = sessionId
  ? await codex.threads.retrieve(sessionId)
  : await codex.threads.create();

// Run with streaming
const run = await codex.threads.runs.create(thread.id, {
  instructions: loadSystemPrompts(),
  additional_instructions: prompt,
  // MCP servers, tools, etc.
});

for await (const event of run.events) {
  // ... event handling
}
```

**IPC follow-up handling:**
The `MessageStream` class is not needed. When a follow-up message arrives via IPC, the Codex runner starts a new `thread.run()` on the same thread — the thread maintains context across runs. The outer while loop in `run()` is structurally identical to the Claude runner's loop:

```typescript
export async function run(containerInput: ContainerInput): Promise<void> {
  // ... setup, build sdkEnv, resolve mcpServerPath

  let sessionId = containerInput.sessionId;
  let prompt = containerInput.prompt;
  // ... drain pending IPC, prepend scheduled task prefix

  while (true) {
    const result = await runCodexQuery(prompt, sessionId, codex, containerInput);
    if (result.newSessionId) sessionId = result.newSessionId;
    if (result.closedDuringQuery) break;

    writeOutput({ status: 'success', result: null, newSessionId: sessionId });

    const nextMessage = await waitForIpcMessage();
    if (nextMessage === null) break;
    prompt = nextMessage;
  }
}
```

---

## Host-Side Changes

### src/config.ts

Add one config value:

```typescript
// After existing envConfig reading:
const sdkConfig = readEnvFile(['AGENT_SDK']);

export const AGENT_SDK: 'claude' | 'codex' =
  (process.env.AGENT_SDK || sdkConfig.AGENT_SDK || 'claude') as 'claude' | 'codex';
```

### src/db.ts + host session state

Session storage must be SDK-scoped.

**Current behavior (single key):**

- `sessions(group_folder -> session_id)`

**Required behavior (scoped key):**

- `sessions(group_folder, sdk -> session_id)`

Suggested API shape:

```typescript
export function getSession(groupFolder: string, sdk: 'claude' | 'codex'): string | undefined;
export function setSession(groupFolder: string, sdk: 'claude' | 'codex', sessionId: string): void;
export function getAllSessions(sdk: 'claude' | 'codex'): Record<string, string>;
```

**Migration requirement:**

- Add `sdk` column with default `'claude'` for existing rows.
- Migrate existing rows to `sdk='claude'` so current installs retain continuity.
- Add unique key on `(group_folder, sdk)`.

### src/index.ts / src/task-scheduler.ts

Where session IDs are loaded/saved, use `AGENT_SDK` to read/write SDK-specific session keys.

- Message loop: `sessions[group.folder]` must represent active-SDK sessions only.
- Scheduler (`context_mode=group`): pass only the active SDK's session to `runContainerAgent()`.

### src/container-runner.ts

Three targeted changes:

**1. Pass `agentSdk` in ContainerInput:**

```typescript
// ContainerInput interface — add field:
export interface ContainerInput {
  // ... existing fields ...
  agentSdk?: 'claude' | 'codex';  // NEW
}
```

In `runContainerAgent()`, the `input` parameter already carries the full `ContainerInput`. The caller (in `src/index.ts` / `src/group-queue.ts`) sets `input.agentSdk = AGENT_SDK` when constructing it. Alternatively, set it in `runContainerAgent()` before passing to stdin:

```typescript
// Before writing to stdin:
import { AGENT_SDK } from './config.js';
input.agentSdk = AGENT_SDK;
input.secrets = readSecrets();
container.stdin.write(JSON.stringify(input));
```

**2. Expand `readSecrets()` to include Codex tokens:**

```typescript
function readSecrets(): Record<string, string> {
  return readEnvFile([
    // Claude SDK
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',
    // Codex SDK
    'CHATGPT_ACCESS_TOKEN',
    'CHATGPT_REFRESH_TOKEN',
    'CHATGPT_MODEL',
    // Shared
    'BRAVE_API_KEY',
    'FIRECRAWL_API_KEY',
  ]);
}
```

Both sets of secrets are always read (they're no-ops if not set in `.env`). This keeps the logic simple — no conditional branching based on AGENT_SDK.

**3. Add Codex sessions mount in `buildVolumeMounts()`:**

After the existing `.claude/` mount (lines 84-130), add:

```typescript
// Per-group Codex sessions directory (parallel to .claude/)
const codexSessionsDir = path.join(DATA_DIR, 'sessions', group.folder, '.codex');
fs.mkdirSync(path.join(codexSessionsDir, 'sessions'), { recursive: true });
mounts.push({
  hostPath: codexSessionsDir,
  containerPath: '/home/node/.codex',
  readonly: false,
});
```

**4. Token refresh before container spawn (conditional):**

```typescript
import { refreshTokenIfNeeded } from './chatgpt-token.js';

// In runContainerAgent(), before readSecrets():
if (AGENT_SDK === 'codex') {
  await refreshTokenIfNeeded();
}
```

### container/Dockerfile

Install both SDKs globally:

```dockerfile
# Install both agent SDKs and MCP servers
RUN npm install -g agent-browser \
    @anthropic-ai/claude-code \
    @openai/codex \
    @modelcontextprotocol/server-brave-search@0.6.2 \
    firecrawl-mcp@3.10.3
```

Add Codex sessions directory:

```dockerfile
RUN mkdir -p /workspace/group /workspace/global /workspace/extra \
    /workspace/ipc/messages /workspace/ipc/tasks /workspace/ipc/input \
    /home/node/.codex/sessions
```

### container/agent-runner/package.json

Include both SDK dependencies:

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.34",
    "@openai/codex-sdk": "^0.1.0",
    "@modelcontextprotocol/sdk": "^1.12.1",
    "cron-parser": "^5.0.0",
    "zod": "^4.0.0"
  }
}
```

---

## New Files

### scripts/chatgpt-oauth.ts — OAuth PKCE Token Acquisition

Standalone script. Run manually during setup or when tokens expire.

- PKCE flow: generate `code_verifier` (random 64 bytes, base64url), derive `code_challenge` (SHA-256 hash, base64url)
- HTTP server on `127.0.0.1:1455`
- Browser opens to `https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http://127.0.0.1:1455/auth/callback&response_type=code&scope=model.request%20api.model.read&code_challenge=...&code_challenge_method=S256`
- Exchanges authorization code for tokens at `https://auth.openai.com/oauth/token`
- Writes `CHATGPT_ACCESS_TOKEN` and `CHATGPT_REFRESH_TOKEN` to `.env`

### src/chatgpt-token.ts — Token Auto-Refresh

Imported by `container-runner.ts`. Called before each container spawn when `AGENT_SDK=codex`.

```typescript
export async function refreshTokenIfNeeded(): Promise<void>
```

- Reads `CHATGPT_ACCESS_TOKEN` and `CHATGPT_REFRESH_TOKEN` from `.env` via `readEnvFile()`
- Decodes JWT, checks `exp` claim. If >5 min remaining, returns early.
- POSTs to `https://auth.openai.com/oauth/token` with `grant_type=refresh_token`
- On success: writes new tokens back to `.env`
- On failure: logs error, throws (caller decides whether to block the container run)

---

## Skill Package Structure

```
.claude/skills/add-codex-sdk/
  SKILL.md                                              # Interactive wizard
  manifest.yaml
  add/
    scripts/chatgpt-oauth.ts                            # OAuth PKCE flow
    src/chatgpt-token.ts                                # Token refresh manager
    container/agent-runner/src/shared.ts                 # Extracted shared code
    container/agent-runner/src/runner-claude.ts          # Extracted Claude runner
    container/agent-runner/src/runner-codex.ts           # New Codex runner
  modify/
    container/agent-runner/src/index.ts                  # Rewrite: thin dispatcher
    container/agent-runner/src/index.ts.intent.md
    container/agent-runner/package.json                  # Add @openai/codex-sdk dep
    container/agent-runner/package.json.intent.md
    container/Dockerfile                                 # Add @openai/codex global install
    container/Dockerfile.intent.md
    src/container-runner.ts                              # Add agentSdk, secrets, mount, token refresh
    src/container-runner.ts.intent.md
    src/config.ts                                        # Add AGENT_SDK config
    src/config.ts.intent.md
  tests/
    codex-sdk.test.ts
```

### manifest.yaml

```yaml
skill: codex-sdk
version: 1.0.0
description: "Add OpenAI Codex SDK as an alternative agent runner — config-driven SDK selection"
core_version: 0.1.0
adds:
  - scripts/chatgpt-oauth.ts
  - src/chatgpt-token.ts
  - container/agent-runner/src/shared.ts
  - container/agent-runner/src/runner-claude.ts
  - container/agent-runner/src/runner-codex.ts
modifies:
  - container/agent-runner/src/index.ts
  - container/agent-runner/package.json
  - container/Dockerfile
  - src/container-runner.ts
  - src/config.ts
structured:
  npm_dependencies:
    "@openai/codex-sdk": "^0.1.0"
  container_npm_dependencies:
    "@openai/codex": "latest"
  env_additions:
    - AGENT_SDK
    - CHATGPT_ACCESS_TOKEN
    - CHATGPT_REFRESH_TOKEN
    - CHATGPT_MODEL
conflicts:
  - add-parallel
depends: []
test: "npx vitest run tests/codex-sdk.test.ts"
```

---

## SKILL.md Phases

### Phase 1: Pre-flight

1. Read `.nanoclaw/state.yaml`. If `codex-sdk` is in `applied_skills`, skip to Phase 3.
2. Confirm: "This skill adds OpenAI Codex SDK as an alternative agent runner alongside the existing Claude Agent SDK. You can switch between them by setting `AGENT_SDK=claude` or `AGENT_SDK=codex` in `.env`. Do you want to proceed?"
3. Note: "The existing Claude SDK path remains fully functional and is the default. No existing behavior changes until you flip the config."

### Phase 2: Apply Code Changes

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-codex-sdk
```

This:
- Adds the 5 new files (oauth script, token manager, shared.ts, runner-claude.ts, runner-codex.ts)
- Rewrites `index.ts` to the thin dispatcher
- Patches `package.json`, `Dockerfile`, `container-runner.ts`, `config.ts`
- Records in `.nanoclaw/state.yaml`

Validate:
```bash
npm run build
npm test
```

### Phase 3: Setup — OAuth Token Acquisition

Ask: "Do you want to set up Codex SDK now, or just install the code and configure later?"

If now:

```bash
npx tsx scripts/chatgpt-oauth.ts
```

1. Opens browser to OpenAI auth page (PKCE flow)
2. User logs in with ChatGPT Plus account
3. Tokens written to `.env`

Ask for preferred model (default: `gpt-4o`). Write `CHATGPT_MODEL` to `.env`.

Set the active SDK:
```bash
# Append to .env
echo 'AGENT_SDK=codex' >> .env
```

### Phase 4: Rebuild Container

```bash
./container/build.sh
```

Required because the container image needs both `@openai/codex` and the restructured agent-runner source.

### Phase 5: Restart and Verify

```bash
# macOS
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Linux
systemctl --user restart nanoclaw
```

Tell the user to send a test message. Verify response. Check logs if needed:

```bash
tail -f logs/nanoclaw.log
```

### Troubleshooting

- **Switching SDKs**: Change `AGENT_SDK` in `.env` and restart NanoClaw. No rebuild needed. Sessions are isolated per SDK, so switching does not reuse the other SDK's session ID.
- **OAuth token expired**: Tokens auto-refresh before each container run. If refresh fails, re-run `npx tsx scripts/chatgpt-oauth.ts`.
- **Container build fails**: `@openai/codex` pulls platform-specific Rust binaries. Ensure container architecture matches host (arm64 for Apple Silicon, amd64 for Linux).
- **Agent not responding on codex**: Check `groups/<name>/logs/` for container log. Look for Codex CLI startup errors or missing `CHATGPT_ACCESS_TOKEN`.
- **Reverting to Claude-only**: Set `AGENT_SDK=claude` in `.env` (or remove the line). The Claude runner path is unchanged and always available.
- **Full revert**: `git checkout container/agent-runner/src/ container/Dockerfile src/container-runner.ts src/config.ts && ./container/build.sh`

---

## Intent Files

### modify/container/agent-runner/src/index.ts.intent.md

```markdown
# Intent: Rewrite index.ts as thin dispatcher

Replace the monolithic agent runner with a dispatcher that reads `agentSdk`
from ContainerInput and delegates to either runner-claude.ts or runner-codex.ts.

All existing logic is preserved — it moves to shared.ts (SDK-agnostic code)
and runner-claude.ts (Claude SDK-specific code). No behavior change for the
default `AGENT_SDK=claude` path.

The dispatcher:
1. Reads stdin JSON (same as before)
2. Deletes /tmp/input.json (same as before)
3. Checks containerInput.agentSdk (default: 'claude')
4. Calls run() from the appropriate runner module
```

### modify/src/container-runner.ts.intent.md

```markdown
# Intent: Add Codex SDK support to container runner

Four changes:
1. Import AGENT_SDK from config.ts, set input.agentSdk before writing to stdin
2. Add CHATGPT_ACCESS_TOKEN, CHATGPT_REFRESH_TOKEN, CHATGPT_MODEL to readSecrets()
3. Call refreshTokenIfNeeded() before readSecrets() when AGENT_SDK=codex
4. Add /home/node/.codex mount in buildVolumeMounts() (parallel to existing .claude/ mount)

All existing mounts, secrets, timeout handling, sentinel parsing unchanged.
```

### modify/container/Dockerfile.intent.md

```markdown
# Intent: Install both agent SDKs

Add @openai/codex to the global npm install alongside @anthropic-ai/claude-code.
Both are installed so the container supports either SDK at runtime.
Add /home/node/.codex/sessions directory for Codex thread persistence.
MCP server installs unchanged.
```

### modify/container/agent-runner/package.json.intent.md

```markdown
# Intent: Add Codex SDK dependency

Add @openai/codex-sdk alongside existing @anthropic-ai/claude-agent-sdk.
Both SDKs coexist — the dispatcher selects which one to use at runtime.
All other dependencies unchanged.
```

### modify/src/config.ts.intent.md

```markdown
# Intent: Add AGENT_SDK config value

Read AGENT_SDK from .env (default: 'claude'). Exported as typed union 'claude' | 'codex'.
No changes to existing config values.
```

### modify/src/db.ts.intent.md

```markdown
# Intent: Scope persisted sessions by SDK

Session identifiers from Claude and Codex are not compatible. Update session
storage and accessors to key by `(group_folder, sdk)` instead of only group.

Migration:
1. Add `sdk` column to `sessions` table
2. Backfill existing rows as `sdk='claude'`
3. Add unique constraint on `(group_folder, sdk)`

This prevents cross-SDK resume errors when AGENT_SDK is switched.
```

### modify/src/index.ts.intent.md

```markdown
# Intent: Read/write session IDs for active SDK only

When invoking `runContainerAgent()`, load the session ID associated with the
current AGENT_SDK. When `newSessionId` is returned, persist it under that same
SDK key.

Do not attempt to reuse Claude sessions in Codex or Codex threads in Claude.
```

### modify/src/task-scheduler.ts.intent.md

```markdown
# Intent: Use SDK-scoped session IDs for scheduled tasks

For `context_mode=group`, scheduler must fetch the session for the active
AGENT_SDK only. This keeps scheduled tasks in the correct conversation thread
after SDK switches.
```

---

## What Stays the Same

- Host orchestrator (`src/index.ts`)
- IPC system (`src/ipc.ts`)
- Message routing (`src/router.ts`)
- Group queue (`src/group-queue.ts`)
- Container runtime (`src/container-runtime.ts`)
- Sentinel output protocol
- Mount security
- All channels
- MCP server (`container/agent-runner/src/ipc-mcp-stdio.ts`)
- Per-group agent-runner customization pattern
- Default behavior (AGENT_SDK defaults to 'claude')

## What Changes (via skill engine)

| Component | Type | Scope |
|---|---|---|
| `scripts/chatgpt-oauth.ts` | add | OAuth PKCE token acquisition |
| `src/chatgpt-token.ts` | add | Token auto-refresh |
| `container/agent-runner/src/shared.ts` | add | Extracted SDK-agnostic code |
| `container/agent-runner/src/runner-claude.ts` | add | Extracted Claude SDK runner |
| `container/agent-runner/src/runner-codex.ts` | add | New Codex SDK runner |
| `container/agent-runner/src/index.ts` | modify | Rewrite as thin dispatcher |
| `container/agent-runner/package.json` | modify | Add `@openai/codex-sdk` dep |
| `container/Dockerfile` | modify | Add `@openai/codex` global install |
| `src/container-runner.ts` | modify | Add agentSdk field, secrets, mount, token refresh |
| `src/config.ts` | modify | Add `AGENT_SDK` config |
| `src/db.ts` | modify | Scope sessions by `(group_folder, sdk)` |
| `src/index.ts` | modify | Persist/restore sessions for active SDK only |
| `src/task-scheduler.ts` | modify | Use active SDK session in group context |

---

## Open Questions

1. **Codex CLI container architecture** — The Rust binary is platform-specific. Need to verify it works in the container's architecture.
2. **MCP server configuration** — Need to verify how Codex SDK configures MCP servers. If the config-based approach doesn't work, fall back to a `~/.codex/config.toml` file written at container startup.
3. **CLAUDE.md loading in Codex** — The `loadSystemPrompts()` helper concatenates all CLAUDE.md files into the prompt. Need to verify Codex respects long system instructions and doesn't truncate.
4. **Session DB migration strategy** — Decide whether to implement as ALTER-in-place or copy-and-swap table migration in the existing SQLite bootstrap path.
