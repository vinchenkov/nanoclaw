/**
 * Codex SDK runner for NanoClaw.
 * Mirrors the Claude runner's query loop pattern using the Codex SDK.
 * Wires up the same MCP servers (nanoclaw IPC, brave, firecrawl) so the
 * agent can send messages, schedule tasks, and search the web.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Codex } from '@openai/codex-sdk';

import {
  ContainerInput,
  IPC_INPUT_DIR,
  IPC_INPUT_CLOSE_SENTINEL,
  IPC_POLL_MS,
  drainIpcInput,
  log,
  shouldClose,
  waitForIpcMessage,
  writeOutput,
} from './shared.js';

/**
 * Build MCP server config for the Codex SDK.
 * Same servers as the Claude runner — nanoclaw IPC, brave search, firecrawl.
 */
function buildMcpConfig(
  containerInput: ContainerInput,
  mcpServerPath: string,
): Record<string, unknown> {
  // Codex config.toml format: flat keys under [mcp_servers.<name>]
  //   command = "..."
  //   args = [...]
  //   env = { KEY = "..." }
  // No nested "transport" wrapper.
  const servers: Record<string, unknown> = {
    nanoclaw: {
      command: 'node',
      args: [mcpServerPath],
      env: {
        NANOCLAW_CHAT_JID: containerInput.chatJid,
        NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
        NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
      },
    },
  };

  if (containerInput.secrets?.BRAVE_API_KEY) {
    servers.brave = {
      command: 'mcp-server-brave-search',
      args: [],
      env: {
        BRAVE_API_KEY: containerInput.secrets.BRAVE_API_KEY,
      },
    };
  }

  if (containerInput.secrets?.FIRECRAWL_API_KEY) {
    servers.firecrawl = {
      command: 'firecrawl-mcp',
      args: [],
      env: {
        FIRECRAWL_API_KEY: containerInput.secrets.FIRECRAWL_API_KEY,
      },
    };
  }

  return servers;
}

/**
 * Discover additional directories mounted at /workspace/extra/* and
 * /workspace/global for Codex SDK's additionalDirectories support.
 * Assumes AGENTS.md (canonical) and CLAUDE.md (symlink) are already
 * set up correctly on the host.
 */
function discoverAdditionalDirs(): string[] {
  const dirs: string[] = [];

  if (fs.existsSync('/workspace/global')) {
    dirs.push('/workspace/global');
  }

  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
      }
    }
  }

  return dirs;
}

/**
 * Poll for the _close sentinel during an active turn.
 * Resolves to true when sentinel is detected.
 * Call stop() to cancel polling when the turn completes normally.
 */
function watchForClose(): { promise: Promise<boolean>; stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const promise = new Promise<boolean>((resolve) => {
    const poll = () => {
      if (stopped) {
        resolve(false);
        return;
      }
      if (shouldClose()) {
        resolve(true);
        return;
      }
      timer = setTimeout(poll, IPC_POLL_MS);
    };
    timer = setTimeout(poll, IPC_POLL_MS);
  });

  return {
    promise,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

/**
 * Run the Codex agent query loop.
 */
export async function runCodexAgent(
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
): Promise<void> {
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel from previous container runs
  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    /* ignore */
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');
  const mcpServers = buildMcpConfig(containerInput, mcpServerPath);

  log(`Codex MCP servers: ${Object.keys(mcpServers).join(', ')}`);

  // Discover additional directories for AGENTS.md auto-import
  const additionalDirs = discoverAdditionalDirs();
  if (additionalDirs.length > 0) {
    log(`Additional directories: ${additionalDirs.join(', ')}`);
  }

  const threadOptions = {
    workingDirectory: '/workspace/group',
    skipGitRepoCheck: true,
    additionalDirectories:
      additionalDirs.length > 0 ? additionalDirs : undefined,
  };

  const codex = new Codex({
    env: sdkEnv as Record<string, string>,
    config: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcp_servers: mcpServers as any,
      sandbox_mode: 'danger-full-access',
    },
  });

  const thread = containerInput.sessionId
    ? codex.resumeThread(containerInput.sessionId, threadOptions)
    : codex.startThread(threadOptions);

  // Build initial prompt (drain any pending IPC messages too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }

  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(
      `Draining ${pending.length} pending IPC messages into initial prompt`,
    );
    prompt += '\n' + pending.join('\n');
  }

  // Query loop: run turn → emit output → drain IPC → wait for IPC → repeat
  while (true) {
    log(
      `Starting Codex turn (session: ${containerInput.sessionId || 'new'})...`,
    );

    // Race the turn against a close sentinel watcher so we don't block
    // indefinitely if the host signals shutdown mid-turn.
    const closeWatcher = watchForClose();
    let closedDuringTurn = false;

    try {
      const result = await Promise.race([
        thread.run(prompt).then((turn) => ({ kind: 'turn' as const, turn })),
        closeWatcher.promise.then((closed) => ({
          kind: 'close' as const,
          closed,
        })),
      ]);

      closeWatcher.stop();

      if (result.kind === 'close' && result.closed) {
        closedDuringTurn = true;
        log('Close sentinel detected during Codex turn');
        // The turn is still running — we can't cancel it, but we exit the loop
        break;
      }

      if (result.kind === 'turn') {
        const newSessionId = thread.id;
        log(
          `Codex turn complete. Session: ${newSessionId}, response length: ${result.turn.finalResponse?.length || 0}`,
        );
        writeOutput({
          status: 'success',
          result: result.turn.finalResponse || null,
          newSessionId: newSessionId ?? undefined,
        });
      }
    } catch (err) {
      closeWatcher.stop();
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Codex turn error: ${errorMessage}`);
      writeOutput({
        status: 'error',
        result: null,
        error: errorMessage,
      });
      // Don't break on error — wait for next IPC message like Claude does
    }

    if (closedDuringTurn) break;

    // Drain any IPC messages that arrived during the turn and bundle them
    // into the next prompt (since Codex can't receive mid-turn messages)
    const midTurnMessages = drainIpcInput();
    if (midTurnMessages.length > 0) {
      log(
        `Drained ${midTurnMessages.length} IPC messages that arrived during turn`,
      );
    }

    // Emit session update so host can track it
    writeOutput({
      status: 'success',
      result: null,
      newSessionId: thread.id ?? undefined,
    });

    log('Codex turn ended, waiting for next IPC message...');

    // If we already have queued messages, don't wait — start next turn immediately
    if (midTurnMessages.length > 0) {
      prompt = midTurnMessages.join('\n');
      log(
        `Using ${midTurnMessages.length} queued messages as next prompt`,
      );
      continue;
    }

    const nextMessage = await waitForIpcMessage();
    if (nextMessage === null) {
      log('Close sentinel received, exiting');
      break;
    }

    log(
      `Got new message (${nextMessage.length} chars), starting new Codex turn`,
    );
    prompt = nextMessage;
  }
}
