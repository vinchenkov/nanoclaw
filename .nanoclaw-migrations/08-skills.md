# Skills reapply plan

`.claude/skills/` is **disposable**. The user does not maintain any custom skill content. Hard-overwrite the entire directory from upstream during migration — don't try to preserve anything from the fork's local copy.

## On upgrade

```bash
rm -rf .claude/skills
git checkout upstream/main -- .claude/skills
```

That's the entire skills migration. The upstream copy is canonical going forward.

## Re-apply only what this install actually uses

Most skills under `.claude/skills/<name>/` are install recipes — they sit there until you run `apply-skill` to actually patch `src/` (channels, integrations) or invoke them as slash commands. After overwriting from upstream, re-run `apply-skill` only for the skills this install actually needs.

For this install, the only required skill application is:

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-discord
```

(Discord is the only active channel — see the homie group's `AGENTS.md`.)

Run `setup` first if the worktree wasn't initialized:

```bash
npx tsx scripts/apply-skill.ts .claude/skills/setup
```

Anything else (other channels, integrations, dev-tooling skills) is opt-in. Pick from upstream's current catalog by browsing `.claude/skills/` after the overwrite.

## What this means in practice

- The fork-local skills you previously had — `add-gmail`, `add-voice-transcription`, `add-telegram-swarm`, `use-local-whisper` — are dropped. They don't have direct upstream equivalents and aren't needed for the active Discord-only setup.
- Stale skills you never used (`add-whatsapp`, `add-slack`, `add-telegram`, `add-parallel`, `qodo-pr-resolver`, `x-integration`, etc.) get refreshed to upstream's current version automatically. No action needed unless you decide to start using one.
- Upstream has added many new skills since the fork's BASE (e.g. `add-codex`, `add-gmail-tool`, `add-imessage`, `add-linear`, `add-resend`, `manage-channels`, `claw`). Browse the upstream `.claude/skills/` after overwrite to see what's available.

## Risk notes

- If `add-discord` upstream has refactored its `modify/*` patches, the patch files may not apply against the architectural changes from sections 01–07 (which themselves modify `src/channels/index.ts`, `src/container-runner.ts`, etc.). Apply order matters: do `add-discord` *before* the architectural sections so its patches apply against fresh upstream files; the architectural sections then layer on top.
- Section 05 of this guide already inlines the manual Discord channel setup (file copy + import line + dep). If `apply-skill add-discord` does the same thing in a different way, prefer the skill's path — it's tracking upstream's evolution.
