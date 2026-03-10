# Codex Hybrid Spec

## Goal
Keep NanoClaw's current integrated `AGENT_SDK=claude|codex` runtime path, while adopting cleaner Codex OAuth packaging and tightening Codex reliability/test coverage.

## Scope
- Preserve current SDK dispatcher architecture (`agentSdk` in host/container input).
- Replace ad-hoc ChatGPT token handling with a reusable OAuth module.
- Add focused Codex runner tests and small runtime hardening.

## Proposed Changes

### 1) Keep Existing Runtime Shape (No Plugin Pivot)
- Keep `AGENT_SDK` as the switch in host config and container dispatcher.
- Keep existing session scoping by `(group_folder, sdk)` in DB.
- Keep current Codex runner integration in `container/agent-runner`.

### 2) Extract OAuth into a Dedicated Package
- Add `packages/codex-oauth/` (local workspace package).
- Move OAuth PKCE + refresh logic from:
  - `scripts/chatgpt-oauth.ts`
  - `src/chatgpt-token.ts`
- Expose a small API:
  - `login()` interactive PKCE flow
  - `getTokens()` auto-refresh + return access token/account id
  - `isAuthenticated()`
- Keep storage location explicit and controlled (existing NanoClaw data path or `.env` bridge if needed for compatibility).

### 3) Codex Runner Hardening
- Wire currently unused `codexEnv` into Codex SDK initialization (or remove dead code).
- Update default codex model to a codex-appropriate default (not `o4-mini`).
- Keep MCP config generation and current IPC loop behavior.

### 4) Test Coverage Additions
- Add unit tests for `runner-codex.ts` event mapping:
  - `thread.started`
  - `item.completed` (`agent_message`)
  - `turn.completed`
  - error path (`error` and `turn.failed`)
- Add tests for OAuth refresh decision logic (expiry buffer, refresh success/failure).
- Keep `container-runner.test.ts` timeout tests unchanged; add codex-specific assertions where relevant.

## Non-Goals
- No migration to provider-plugin architecture in this iteration.
- No replacement of current Claude path.
- No broad channel/router changes.

## Acceptance Criteria
- `AGENT_SDK=codex` works end-to-end with refreshed tokens from the new oauth package.
- `AGENT_SDK=claude` behavior is unchanged.
- Codex runner has deterministic tests for success and failure event paths.
- Build and tests pass:
  - `npm run build`
  - `npm test`
