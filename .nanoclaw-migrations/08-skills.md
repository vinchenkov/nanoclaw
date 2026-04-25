# Skills reapply plan

The user confirmed they never modified skill *content* directly after applying — so all upstream-derived skills should be reapplied from upstream's latest version, not from the fork's stale copy. This automatically picks up upstream's evolution of the skill system (intent files, manifest restructuring, npm/pnpm conventions, etc.).

## Strategy

1. Don't merge `upstream/skill/*` branches — none of the fork's skills came in via branch merge. They were applied via `scripts/apply-skill.ts`.
2. For each upstream-derived skill: run `npx tsx scripts/apply-skill.ts .claude/skills/<name>` against the **upstream version** of the skill content (already present in upstream's `.claude/skills/`).
3. For custom-authored skills: copy `.claude/skills/<name>/` verbatim from the user's tree.

## Upstream-derived skills (reapply via `apply-skill`)

These exist in `upstream/main:.claude/skills/`. The fork's local copy is a stale snapshot — reapply from upstream's current version.

| Skill | Upstream source | Kind | Required for this install? |
|---|---|---|---|
| `add-discord` | `upstream/main:.claude/skills/add-discord/` | source-modifying | **yes** — primary channel |
| `add-ollama-tool` | `upstream/main:.claude/skills/add-ollama-tool/` (also `upstream/skill/ollama-tool`) | source-modifying | optional |
| `add-parallel` | `upstream/main:.claude/skills/add-parallel/` | source-modifying | optional |
| `add-slack` | `upstream/main:.claude/skills/add-slack/` | source-modifying | optional |
| `add-telegram` | `upstream/main:.claude/skills/add-telegram/` | source-modifying | optional |
| `add-whatsapp` | `upstream/main:.claude/skills/add-whatsapp/` | source-modifying | optional |
| `convert-to-apple-container` | `upstream/main:.claude/skills/convert-to-apple-container/` (also `upstream/skill/apple-container`) | source-modifying | optional |
| `customize` | `upstream/main:.claude/skills/customize/` | pure-instructions | optional |
| `debug` | `upstream/main:.claude/skills/debug/` | pure-instructions | optional |
| `get-qodo-rules` | `upstream/main:.claude/skills/get-qodo-rules/` | pure-instructions | optional |
| `migrate-nanoclaw` | `upstream/main:.claude/skills/migrate-nanoclaw/` (also `upstream/skill/migrate-nanoclaw`) | mixed | this skill — already there if you ran it |
| `qodo-pr-resolver` | `upstream/main:.claude/skills/qodo-pr-resolver/` | pure-instructions | optional |
| `setup` | `upstream/main:.claude/skills/setup/` | source-modifying | **yes** — run first |
| `update-nanoclaw` | `upstream/main:.claude/skills/update-nanoclaw/` | pure-instructions | optional |
| `update-skills` | `upstream/main:.claude/skills/update-skills/` | pure-instructions | optional |
| `x-integration` | `upstream/main:.claude/skills/x-integration/` | source-modifying | optional |

For skills that exist on both `upstream/main` and `upstream/skill/<name>`, prefer `upstream/main` — branches tend to be out of date.

## Custom-authored skills (copy verbatim)

These have no upstream equivalent. Copy `.claude/skills/<name>/` from the user's main tree to the worktree as-is.

- **`add-gmail`** — `manifest.yaml` + `SKILL.md` + `add/`, `modify/`, `tests/`. Source-modifying: adds `gmail.ts` channel, modifies `src/channels/index.ts`, `src/container-runner.ts`, `container/agent-runner/src/index.ts`. Run `apply-skill` after copy if you want it applied.
- **`add-telegram-swarm`** — `SKILL.md` only. Pure-instructions extension on top of `add-telegram`. Reference only; no `apply-skill` action.
- **`add-voice-transcription`** — `manifest.yaml` + `SKILL.md` + `add/`, `modify/`, `tests/`. Source-modifying: adds `transcription.ts`, modifies WhatsApp handling. Depends on `add-whatsapp` being applied first.
- **`use-local-whisper`** — `manifest.yaml` + `SKILL.md` + `modify/`, `tests/`. Depends on `add-voice-transcription`. Modifies `transcription.ts` to use local whisper.cpp instead of OpenAI Whisper API.

## Apply order

1. `setup` — must run first (initial scaffolding).
2. `add-discord` — primary channel for this install.
3. Other upstream channel skills if you want them.
4. `add-gmail` (custom) if you want Gmail.
5. `add-telegram` then `add-voice-transcription` then `use-local-whisper` (custom chain) if you want voice.
6. Any other optional upstream skills.

After all skills are applied, return to the architectural sections (01–07).

## Risk notes

- Several upstream skills have likely evolved their internal mechanism in 875 commits (intent files, manifest restructuring). Reapplying from upstream's current version is the right move precisely because of this — the fork's stale copy would re-introduce the old structure.
- Custom skills (`add-gmail`, `add-voice-transcription`, `use-local-whisper`) target file paths that may have shifted upstream. After apply, build + test; if a `modify/*.patch` fails to apply, the upstream file structure has changed and the custom skill needs updating before the migration can complete.
- `add-telegram-swarm` is documentation only — confirm it doesn't reference removed/renamed Telegram skill internals if you keep it.
