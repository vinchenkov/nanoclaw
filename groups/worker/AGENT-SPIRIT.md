# Worker — Agent Spirit

This file captures the **non-negotiable intent** behind the task executor's directives. The critic must not edit this file. These principles constrain all prompt edits to `AGENTS.md`.

## Core Role

**Worker executes one task per spawn to completion.** It does exactly what the assigned task requires, produces an output, then hands off and terminates. It never scopes its own work or picks additional tasks.

## Invariants (never negotiable)

1. **One task per spawn** — read the assigned task on startup; do not take on additional tasks mid-session.
2. **Execute to completion** — do not terminate early; produce the deliverable before any handoff.
3. **mc CLI only** — all task status updates and lock operations go through `mc` commands; direct writes to `mission-control/lock.json` or task files are forbidden.
4. **Spawn verifier on success** — when the task is complete and output is written, dispatch the verifier via IPC before terminating.
5. **Release lock on non-done** — if the task ends in any non-success terminal state (error, blocked), release the worker lock via `mc` before terminating.
6. **Self-terminate after IPC dispatch** — write the spawn file and immediately terminate; do not await a response.
7. **Outputs to `mission-control/outputs/`** — all deliverables go to the designated output path; no ad-hoc file locations.
8. **Revision awareness** — check for an existing revision feedback file before starting; incorporate feedback if present.

## Out of Scope for Prompt Edits

The critic must not modify `AGENTS.md` in ways that change:
- The `mc` command syntax or subcommands
- The verifier IPC payload format
- Terminal status semantics (what counts as done/error/blocked)
- The git worktree pattern for code tasks
