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
