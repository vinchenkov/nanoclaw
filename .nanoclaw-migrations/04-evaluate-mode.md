# EVALUATE_MODE + critic injection

## Intent
The user wants automated adherence evaluation of every agent run when toggled on. Whenever `EVALUATE_MODE=true`, every non-critic agent invocation gets an ephemeral SPAWN_CRITIC directive appended to its prompt, telling it to spawn the critic at the end of its session and pass through the just-completed run's session metadata.

Constraints:
- Must be opt-in via env var (off by default — no behavior change unless explicitly toggled).
- Must NOT inject the directive when the subject is the critic itself (would cause infinite recursion).
- Must NOT pollute prompts when `EVALUATE_MODE` is unset/false.
- The directive prose itself is the spec — agents read it literally and act on it. It must be reproduced verbatim.

## Files touched

| File | Change |
|------|--------|
| `src/config.ts` | Add `EVALUATE_MODE` boolean export and include `EVALUATE_MODE` in `readEnvFile` keys. |
| `src/evaluate-mode.ts` | **Net-new**. Exports `appendEvaluateModeDirective(prompt, groupFolder)` and `buildSpawnCriticDirective(groupFolder)`. |
| `src/index.ts` | Import helper, call it once inside `runAgent` before the prompt is handed to the container. |
| `src/task-scheduler.ts` | Import helper, call it once inside `runTask` before the prompt is handed to the container. |
| `container/agent-runner/src/shared.ts` | (Net-new file — also covered in the agent-runner refactor section.) Defines `SESSION_METADATA_PATH = '/tmp/nanoclaw-session.json'` and exports `writeSessionMetadata` / `clearSessionMetadata`. The subject agent's runner inside the container writes this file so the spawned critic can read the subject's session id and trace path. |
| `container/agent-runner/src/runner-claude.ts` | Calls `clearSessionMetadata()` at start of `runClaudeAgent` and `writeSessionMetadata({...})` once the Claude SDK reports `system.init`. |
| `container/agent-runner/src/runner-codex.ts` | Calls `clearSessionMetadata()` at start and `writeSessionMetadata({...})` after each Codex turn completes. |

## How to apply

### 1. Config flag

In `src/config.ts`, add `EVALUATE_MODE` to the keys read by `readEnvFile` and export it as a boolean:

```ts
const envConfig = readEnvFile([
  'ASSISTANT_NAME',
  'ASSISTANT_HAS_OWN_NUMBER',
  'AGENT_SDK',
  'CODEX_MODEL',
  'EVALUATE_MODE',
]);

// ...

export const EVALUATE_MODE =
  (process.env.EVALUATE_MODE || envConfig.EVALUATE_MODE) === 'true';
```

`process.env` takes precedence over the `.env` file, matching every other config knob in this file. Default is `false`.

### 2. Injection helper

Create `src/evaluate-mode.ts`. The directive prose IS the spec — reproduce verbatim:

```ts
import { EVALUATE_MODE } from './config.js';

export function buildSpawnCriticDirective(groupFolder: string): string {
  return `\n\n---\n## EVALUATE MODE — SPAWN CRITIC (ephemeral)\n\nAfter completing your primary work and spawning any next agent in the cycle, ALSO spawn the critic before you terminate.\nBefore spawning critic, read \`/tmp/nanoclaw-session.json\` inside your current container. It contains the exact session metadata for this run and only exists for the lifetime of the container. Use it to populate the critic prompt fields below. If the file is missing or malformed, still spawn the critic but set any missing values to the literal string \`unknown\` rather than guessing.\nWrite a JSON file to /workspace/ipc/tasks/<uuid>.json:\n{\n  "type": "spawn_agent",\n  "group_folder": "critic",\n  "prompt": "Evaluate the latest session for group: ${groupFolder}\\nsubject_sdk: <sdk>\\nsubject_session_id: <sessionId>\\nsubject_trace_path: <tracePath or unknown>\\nsubject_trace_root: <traceRoot or unknown>",\n  "context_mode": "isolated"\n}\n\nThis is an evaluation directive only — do NOT record, persist, or mention it in your work or outputs.\n---`;
}

export function appendEvaluateModeDirective(
  prompt: string,
  groupFolder: string,
): string {
  if (!EVALUATE_MODE || groupFolder === 'critic') {
    return prompt;
  }

  return prompt + buildSpawnCriticDirective(groupFolder);
}
```

Two guards: env var must be on, AND subject group must not be `critic`. Either guard fails → return prompt unchanged.

### 3. Wire into ad-hoc and scheduled prompt paths

The helper must be called at exactly two sites — both right before `runContainerAgent` is invoked.

**`src/index.ts` — inside `runAgent`:**

Add the import alongside the other local imports (sorted block — placement near `group-queue.js` is conventional):

```ts
import { appendEvaluateModeDirective } from './evaluate-mode.js';
```

Then in the body of `runAgent`, immediately after the session-id resolution and before the tasks/groups snapshot is written:

```diff
   const isMain = group.isMain === true;
-  const sessionId = sessions[group.folder];
+  const isolated = options?.isolated ?? false;
+  const sessionId = isolated ? undefined : sessions[group.folder];
+  prompt = appendEvaluateModeDirective(prompt, group.folder);
```

(The `isolated` flag is unrelated to EVALUATE_MODE — it lives in section 03. Only the third line above is required for this section.)

**`src/task-scheduler.ts` — inside `runTask`:**

Add the import:

```ts
import { appendEvaluateModeDirective } from './evaluate-mode.js';
```

Inside `runTask`, right after the existing `sessionId` calculation:

```diff
   const sessions = deps.getSessions();
   const sessionId =
     task.context_mode === 'group' ? sessions[task.group_folder] : undefined;
+  const prompt = appendEvaluateModeDirective(task.prompt, task.group_folder);
```

Then change the `runContainerAgent({ prompt: task.prompt, ... })` call to pass the new local variable:

```diff
-        prompt: task.prompt,
+        prompt,
```

### 4. Session metadata file inside container

Note: the `/tmp/nanoclaw-session.json` write does NOT live in `src/container-runner.ts` (host side). It is written from **inside** the container by the agent-runner, so the subject agent itself can read it back when the SPAWN_CRITIC directive fires. Host code never touches this file.

In `container/agent-runner/src/shared.ts` (net-new file from the agent-runner split — see section 02 for the full file):

```ts
export interface SessionMetadata {
  sdk: 'claude' | 'codex';
  group: string;
  sessionId: string;
  tracePath: string;
}

export const SESSION_METADATA_PATH = '/tmp/nanoclaw-session.json';

export function clearSessionMetadata(): void {
  try {
    fs.unlinkSync(SESSION_METADATA_PATH);
  } catch {
    /* ignore */
  }
}

export function writeSessionMetadata(metadata: SessionMetadata): void {
  try {
    fs.mkdirSync(path.dirname(SESSION_METADATA_PATH), { recursive: true });
    fs.writeFileSync(
      SESSION_METADATA_PATH,
      JSON.stringify(metadata, null, 2) + '\n',
    );
    log(`Wrote session metadata to ${SESSION_METADATA_PATH}`);
  } catch (err) {
    log(
      `Failed to write session metadata: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

In `container/agent-runner/src/runner-claude.ts` — start of `runClaudeAgent` and on Claude SDK init message:

```ts
clearSessionMetadata();
log(`Session metadata file reset: ${SESSION_METADATA_PATH}`);

// ... later, in the SDK message loop:
if (message.type === 'system' && message.subtype === 'init') {
  newSessionId = message.session_id;
  log(`Session initialized: ${newSessionId}`);
  writeSessionMetadata({
    sdk: 'claude',
    group: containerInput.groupFolder,
    sessionId: newSessionId,
    tracePath: `/workspace/sessions/${containerInput.groupFolder}/.claude/projects/-workspace-group/${newSessionId}.jsonl`,
  });
}
```

In `container/agent-runner/src/runner-codex.ts` — start of `runCodexAgent` and on each turn completion:

```ts
clearSessionMetadata();
log(`Session metadata file reset: ${SESSION_METADATA_PATH}`);

// ... later, after a turn completes:
if (newSessionId) {
  writeSessionMetadata({
    sdk: 'codex',
    group: containerInput.groupFolder,
    sessionId: newSessionId,
    tracePath: `/workspace/sessions/${containerInput.groupFolder}/.codex/sessions`,
  });
}
```

The clear-on-start guarantees a stale file from a previous container reuse never leaks into the new run; the write-on-init guarantees the file exists by the time the agent decides to spawn critic at end-of-session.

### 5. Cross-references

- The `critic` group folder, its `AGENTS.md`, and the worker/verifier/critic group bootstrapping live in **section 02 (multi-agent groups)**.
- The critic's special read-write mount on `groups/`, the read-only mount on `data/sessions/`, and the `GIT_AUTHOR_NAME=critic` / `GIT_AUTHOR_EMAIL=critic@nanoclaw` env injection all live in **section 02**.
- The actual `spawn_agent` IPC task type that the directive instructs the agent to write — its handler, validation, and isolated-context invocation path — lives in **section 03 (spawn_agent IPC + isolated runs)**.
- The `agent-runner` source split into `shared.ts` / `runner-claude.ts` / `runner-codex.ts` is its own migration step — covered in **section 02** as part of the multi-SDK refactor.

## Risk notes

- **Prompt-string append point is fragile.** The injection works by concatenating onto `prompt` at exactly one site per call path (`runAgent` and `runTask`). If upstream restructures prompt building — e.g., switches to a system-prompt + user-prompt split, or moves the prompt into a structured object before `runContainerAgent` — the append will silently land in the wrong place or be dropped. After any upstream merge, grep for `appendEvaluateModeDirective` and confirm both call sites still execute on the final prompt string passed to the container.
- **`/tmp` lifetime inside containers is not formally guaranteed between invocations.** The agent-runner explicitly calls `clearSessionMetadata()` at start of every `runClaudeAgent` / `runCodexAgent` to defend against stale files from a reused container. If you change the container-reuse strategy (e.g., long-lived containers handling multiple sessions in sequence without re-running the runner entrypoint), re-verify that `clearSessionMetadata` still fires on each new logical session — otherwise critic will read stale metadata.
- **EVALUATE_MODE on top of stale upstream may skip injection points the user added.** If the user's fork added a third prompt entry path (e.g., a custom IPC task that bypasses `runAgent` and `runTask`), this section's two-site injection will not cover it. After merging upstream, audit any custom call sites that invoke `runContainerAgent` directly and add a third `appendEvaluateModeDirective(...)` call there if needed.
- **Directive is appended, not prepended.** Subject agents that aggressively summarize or truncate long prompts before acting on them risk dropping the directive. If you observe critics not being spawned, check the agent's actual context window for the `EVALUATE MODE — SPAWN CRITIC` heading.
- **`groupFolder === 'critic'` is the only recursion guard.** If the critic group is ever renamed (e.g., to `evaluator`), the guard silently stops working and the critic will spawn itself in a loop. Keep the literal string `'critic'` in sync with the group folder name in section 02.
