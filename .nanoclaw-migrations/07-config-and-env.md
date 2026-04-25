# Config + env catalog

Catalog of new config flags, env vars, and secrets the fork introduces. Apply this section first so the rest can wire to them.

## Files touched

- `src/config.ts` (modified) — three new exports
- `src/container-runner.ts` (modified) — secrets list extended
- `package.json` (modified) — `discord.js` dep (handled in section 05)
- `.gitignore` (modified) — group-tracking unblocked, prompt-metrics ignored

## How to apply

### 1. New config exports in `src/config.ts`

Extend the `readEnvFile` allowlist and add three exports. The pattern follows existing exports.

```typescript
const envConfig = readEnvFile([
  'ASSISTANT_NAME',
  'ASSISTANT_HAS_OWN_NUMBER',
  'AGENT_SDK',
  'CODEX_MODEL',
  'EVALUATE_MODE',
]);

export const AGENT_SDK: 'claude' | 'codex' = (process.env.AGENT_SDK ||
  envConfig.AGENT_SDK ||
  'claude') as 'claude' | 'codex';
export const CODEX_MODEL: string | undefined =
  process.env.CODEX_MODEL || envConfig.CODEX_MODEL || undefined;
export const EVALUATE_MODE =
  (process.env.EVALUATE_MODE || envConfig.EVALUATE_MODE) === 'true';
```

`ASSISTANT_NAME` and `ASSISTANT_HAS_OWN_NUMBER` were already at BASE — leave alone unless upstream changed their semantics.

### 2. Env vars

| Var | Source | Consumed by | Default |
|---|---|---|---|
| `AGENT_SDK` | `.env` or process | `src/config.ts` → runtime-registry, container-runner, agent-runner dispatcher | `claude` |
| `CODEX_MODEL` | `.env` or process | `src/runtime-registry.ts` → writes to `/home/node/.codex/config.toml` | unset |
| `OPENAI_BASE_URL` | `.env` or process | injected into container env by `src/container-runner.ts` (Codex with OpenAI-compatible endpoints) | unset |
| `EVALUATE_MODE` | `.env` or process | `src/config.ts` → `src/evaluate-mode.ts` (section 04) | `false` |
| `DISCORD_BOT_TOKEN` | `.env` or process | `src/channels/discord.ts` factory (section 05) | required to enable Discord |

### 3. New secrets in `src/container-runner.ts`

The secrets list (already includes `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` at BASE) should be extended to:

```
CLAUDE_CODE_OAUTH_TOKEN
ANTHROPIC_API_KEY
BRAVE_API_KEY        # new — brave MCP server
FIRECRAWL_API_KEY    # new — firecrawl MCP server
CODEX_API_KEY        # new — Codex SDK auth (alternative to OAuth via setup/codex-auth.ts)
OPENAI_BASE_URL      # new — Codex OpenAI-compat endpoint
```

These are read on the host and passed to containers via stdin — never written to disk. Add to whatever array upstream uses for the container secrets list. Position/structure may have changed in 875 commits; locate by symbol, not by line number.

### 4. `.gitignore`

Decision needed on upgrade. The fork removed the BASE-era block that limited tracked groups to `main`/`global`, allowing all `groups/*` to be tracked. This is how mission-control state ended up in git.

Recommendation: restore selective blocking of runtime state but keep AGENTS.md/AGENT-SPIRIT.md/CLAUDE.md tracked.

```
# Groups - track AGENTS.md and config; ignore runtime state
groups/*/briefings/
groups/critic/critiques/
groups/shared/mission-control/
groups/state/
**/prompt-metrics.json
**/activity.log.ndjson
```

(`**/prompt-metrics.json` is already in the fork's .gitignore but the existing tracked copies pre-date that rule and persist.)

## Risk notes

- `ASSISTANT_HAS_OWN_NUMBER` existed at BASE; if upstream renamed or repurposed it in 875 commits, re-read the upstream definition before re-using.
- The secrets array in `container-runner.ts` may have moved or been split into per-runtime arrays upstream — locate by reading the surrounding context, not by line offset.
- Re-applying skills (e.g. `add-discord`) may set additional env vars in `.env` or `.env.example`. Audit the env files after running `apply-skill` for any skill.
