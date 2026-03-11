/**
 * NanoClaw Agent Runner — Dispatcher
 * Runs inside a container, receives config via stdin, dispatches to the
 * appropriate SDK runner (Claude or Codex) based on agentSdk field.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent turn).
 *   Final marker after loop ends signals completion.
 */

import fs from 'fs';

import { ContainerInput, log, readStdin, writeOutput } from './shared.js';
import { runClaudeAgent } from './runner-claude.js';
import { runCodexAgent } from './runner-codex.js';

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    // Delete the temp file the entrypoint wrote — it contains secrets
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

  // Build SDK env: merge secrets into process.env for the SDK only.
  // Secrets never touch process.env itself, so Bash subprocesses can't see them.
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
