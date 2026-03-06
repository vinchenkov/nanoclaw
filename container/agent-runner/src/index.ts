/**
 * NanoClaw Agent Runner — Dispatcher
 * Reads ContainerInput from stdin, delegates to the appropriate SDK runner.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent teams result).
 *   Final marker after loop ends signals completion.
 */

import fs from 'fs';
import { readStdin, log, writeOutput } from './shared.js';
import { run as runClaude } from './runner-claude.js';
import { run as runCodex } from './runner-codex.js';
import type { ContainerInput } from './shared.js';

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
