# Auto Engineer Agent Directives

I want to ensure each agent is maximally, and effectively carrying out its instructions.
Each agent's instructions are located at "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/<group>/AGENTS.md"
These files will be auto prompt-engineered over time.

## Enhance Critic
I already have an agent called Critic. This agent is spawned after a subject agent completes its work. The critic reads through the subject's trace log to reason about its actions and how well it adhered to its directives.

Currently, the critic writes down its critique at "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/critic/critiques/". What the critic outputs into these files can be inferred from its own directive here: "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/critic/AGENTS.md".

The critic should now use its own critique, to prompt engineer the subject's directive file.

## Directive Spirit
I foresee the critic running many times over long periods. I imagine a recursive process such as this would create a trajectory where the initial directives at "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/<group>/AGENTS.md" are spiraling further and further away from their intended purpose.

To mitigate this each group should also have a AGENT-SPIRIT.md file in that same dir. This file will act as the baseline and capture the "spirit" of the initial directive set.

-- The critic should **invariantly** reference the spirit file to ensure the newly prompt engineered directive adheres to the original spirit.

## How to Prompt Engineer
In addition to following the original spirit of the prompt, when prompt engineering the critic should:
1. **Simplify first** — Prefer removing or consolidating existing text over adding new text. When a suggestion from the critique can be addressed by tightening existing language rather than appending new rules, always take that path.
2. **No bloat** — Prompt engineering is not strictly additive. If an additive change is necessary that is fine. However, clutter that can be removed without harming clarity should be removed. The prompt should never reach a ridiculous length like a thousand lines.
3. **Data over thinking** — Optimize for how the agent organizes data, not how it should think. Directives should define clear context hierarchies, retrieval priorities, and data structure.
4. **Atomicity**: Make exactly one targeted edit per critique cycle. Do not make multiple simultaneous changes. This ensures each penalty signal is attributable to a specific change, enabling clean keep/revert decisions.

## Metric

Each critique file must include a defect list and total penalty in its YAML frontmatter:

```yaml
---
subject: <group>
session: <path>
evaluated_at: <ISO>
prompt_commit: <git SHA of subject's AGENTS.md at session time>
defects:
  - type: directive_violation
    penalty: 3
    note: "Skipped lock acquisition before writing task output"
  - type: unnecessary_action
    penalty: 2
    note: "Read context file not needed for this task"
total_penalty: 5
---
```

**Defect types and penalties (additive):**

| Type | Penalty | When to use |
|---|---|---|
| `role_breach` | 10 | Acted entirely outside its defined role (e.g., worker sent a Discord message, verifier modified code) |
| `hard_constraint_violation` | 8 | Violated a hard constraint (wrong namespace write, wrong lock operation, skipped self-termination) |
| `pipeline_degradation` | 5 | Caused state requiring the next agent to compensate or requiring manual recovery |
| `directive_violation` | 3 | Violated an explicit directive in a way that affected output (wrong IPC format, out-of-order steps, skipped required step) |
| `unnecessary_action` | 2 | Unnecessary read, write, or tool use that did not affect output |
| `self_corrected` | 1 | Deviation that was caught and corrected before affecting output |

List every observed defect instance separately — the same type can appear multiple times. `total_penalty` is the sum of all penalty values. When no session trace exists, omit all defect fields and note the absence in the critique body.

## Tracking

### Tracking File: `groups/{group}/prompt-metrics.json`

```json
{
  "baseline_mean": 3.4,
  "penalties": [4, 2, 5, 3, 1],
  "last_edit_commit": "<sha>"
}
```

- `baseline_mean`: mean total_penalty from the last completed 5-run window. Absent on cold start.
- `penalties`: total_penalty values accumulating since the last prompt edit. Each run appends one value.
- `last_edit_commit`: SHA of the most recent AGENTS.md edit commit. Used to restore the pre-edit file if a revert is needed.

### Algorithm

**Every run**, after writing the critique:
1. Append `total_penalty` to `penalties`.
2. If `penalties` has fewer than 5 entries: save and terminate.
3. 5 entries reached — compute `new_mean = mean(penalties)`.

#### Once 5 entries are accumulated

**Cold start** (`baseline_mean` absent):
- Set `baseline_mean` = `new_mean`. Reset `penalties` to `[]`.
- Make one atomic prompt edit (see below). Save and terminate.

**Normal cycle** (`baseline_mean` present):
- `new_mean < baseline_mean` → **keep**, set `baseline_mean` = `new_mean`.
- `new_mean >= baseline_mean` → **revert** (equal or worse = no signal, default conservative).
- Reset `penalties` to `[]`. Make one atomic prompt edit. Save and terminate.

### Making a Prompt Edit

1. Read the most recent critique for this group (filter `groups/critic/critiques/` by `subject` field).
2. Read `groups/<group>/AGENT-SPIRIT.md`.
3. Select the single most impactful suggestion from the critique's Suggestions section. If multiple suggestions are equally impactful, prefer whichever one simplifies or shortens the prompt.
4. Verify the edit does not contradict the spirit file. If it does, choose a different suggestion.
5. Edit `<group>/AGENTS.md` (one conceptual change only).
6. Commit:
   ```bash
   git -C /workspace/groups add <group>/AGENTS.md
   git -C /workspace/groups commit -m "critic: adjust <group> — <one-line reason>"
   ```
7. Save the resulting SHA to `last_edit_commit`.

### Reverting

```bash
git -C /workspace/groups checkout <last_edit_commit>^ -- <group>/AGENTS.md
git -C /workspace/groups commit -m "critic: revert <group> — <reason>"
```

### Multi-Group Operation

Each group has its own `prompt-metrics.json`. The critic is invoked per group and only touches that group's state. Groups never interfere with each other.

### Invariants
- Never edit `AGENT-SPIRIT.md`
- Never edit the critic's own `AGENTS.md`

## Directive Spirit

Each group folder contains `AGENT-SPIRIT.md` — a human-authored, immutable baseline written by Vinny. It captures the non-negotiable intent and core behaviors the group's directive must always preserve.

Before making any prompt edit, the critic MUST:
1. Read `/workspace/groups/<group>/AGENT-SPIRIT.md`
2. Verify the proposed edit does not contradict the spirit
3. If the suggested change would violate the spirit, skip the edit and note it in the critique

The critic may NEVER modify `AGENT-SPIRIT.md`.
