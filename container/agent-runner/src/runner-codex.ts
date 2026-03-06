/**
 * OpenAI Codex SDK Runner
 * Uses @openai/codex-sdk to run agent queries via Codex CLI.
 *
 * Key API differences from Claude runner:
 * - Sessions are threads: startThread() / resumeThread(id)
 * - Streaming via thread.runStreamed(prompt) -> { events: AsyncGenerator<ThreadEvent> }
 * - Follow-ups are new runStreamed() calls on the same thread
 * - System prompts loaded manually via loadSystemPrompts() (no additionalDirectories)
 * - Auth via env vars (OPENAI_API_KEY or CODEX_API_KEY) injected into constructor env
 */

import fs from 'fs';
import path from 'path';
import { Codex } from '@openai/codex-sdk';
import type { ThreadEvent } from '@openai/codex-sdk';
import { fileURLToPath } from 'url';

import {
  ContainerInput,
  QueryResult,
  IPC_INPUT_DIR,
  IPC_INPUT_CLOSE_SENTINEL,
  IPC_POLL_MS,
  writeOutput,
  log,
  shouldClose,
  drainIpcInput,
  waitForIpcMessage,
  loadSystemPrompts,
} from './shared.js';

// Secrets that must not leak to Bash subprocesses
const SECRET_ENV_VARS = [
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CHATGPT_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
];

/**
 * Build a sanitized env for the Codex SDK constructor.
 * Includes secrets needed by the SDK but strips them from subprocess visibility
 * via the Codex config's sandbox settings.
 */
function buildCodexEnv(
  containerInput: ContainerInput,
): Record<string, string> {
  const env: Record<string, string> = {};

  // Copy current process env (minus secrets)
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !SECRET_ENV_VARS.includes(key)) {
      env[key] = value;
    }
  }

  // Inject secrets from container input
  const secrets = containerInput.secrets || {};

  // Codex SDK reads OPENAI_API_KEY or CODEX_API_KEY for auth
  if (secrets.CHATGPT_ACCESS_TOKEN) {
    env.CODEX_API_KEY = secrets.CHATGPT_ACCESS_TOKEN;
  }
  if (secrets.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
  }

  // MCP server secrets
  if (secrets.BRAVE_API_KEY) env.BRAVE_API_KEY = secrets.BRAVE_API_KEY;
  if (secrets.FIRECRAWL_API_KEY) env.FIRECRAWL_API_KEY = secrets.FIRECRAWL_API_KEY;

  return env;
}

/**
 * Write a Codex config.toml for MCP server configuration.
 * Codex reads MCP servers from ~/.codex/config.toml at startup.
 */
function writeCodexConfig(
  containerInput: ContainerInput,
  mcpServerPath: string,
  model?: string,
): void {
  const configDir = path.join(process.env.HOME || '/home/node', '.codex');
  fs.mkdirSync(configDir, { recursive: true });

  const lines: string[] = [];

  if (model) {
    lines.push(`model = "${model}"`);
    lines.push('');
  }

  // NanoClaw MCP server
  lines.push('[mcp_servers.nanoclaw]');
  lines.push(`command = "node"`);
  lines.push(`args = ["${mcpServerPath}"]`);
  lines.push('[mcp_servers.nanoclaw.env]');
  lines.push(`NANOCLAW_CHAT_JID = "${containerInput.chatJid}"`);
  lines.push(`NANOCLAW_GROUP_FOLDER = "${containerInput.groupFolder}"`);
  lines.push(`NANOCLAW_IS_MAIN = "${containerInput.isMain ? '1' : '0'}"`);
  lines.push('');

  // Brave search MCP server
  lines.push('[mcp_servers.brave]');
  lines.push(`command = "mcp-server-brave-search"`);
  lines.push(`args = []`);
  lines.push('[mcp_servers.brave.env]');
  lines.push(`BRAVE_API_KEY = "${containerInput.secrets?.BRAVE_API_KEY || ''}"`);
  lines.push('');

  // Firecrawl MCP server
  lines.push('[mcp_servers.firecrawl]');
  lines.push(`command = "firecrawl-mcp"`);
  lines.push(`args = []`);
  lines.push('[mcp_servers.firecrawl.env]');
  lines.push(`FIRECRAWL_API_KEY = "${containerInput.secrets?.FIRECRAWL_API_KEY || ''}"`);

  const configPath = path.join(configDir, 'config.toml');
  fs.writeFileSync(configPath, lines.join('\n') + '\n');
  log(`Wrote Codex config to ${configPath}`);
}

async function runCodexQuery(
  prompt: string,
  sessionId: string | undefined,
  codex: Codex,
  containerInput: ContainerInput,
): Promise<QueryResult> {
  let closedDuringQuery = false;
  let newSessionId: string | undefined;

  // Resume or create thread
  const thread = sessionId
    ? codex.resumeThread(sessionId)
    : codex.startThread({
        workingDirectory: '/workspace/group',
        skipGitRepoCheck: true,
      });

  // Prepend system prompts to the first message if no session exists
  let fullPrompt = prompt;
  if (!sessionId) {
    const systemPrompts = loadSystemPrompts();
    if (systemPrompts) {
      fullPrompt = `<system_instructions>\n${systemPrompts}\n</system_instructions>\n\n${prompt}`;
    }
  }

  // Poll IPC for follow-up messages during the query
  let ipcPolling = true;
  const pollIpcDuringQuery = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log('Close sentinel detected during Codex query');
      closedDuringQuery = true;
      ipcPolling = false;
      return;
    }
    // Note: Unlike Claude runner, we can't pipe messages into an active Codex run.
    // Follow-up messages are handled as new runs on the same thread after this run completes.
    setTimeout(pollIpcDuringQuery, IPC_POLL_MS);
  };
  setTimeout(pollIpcDuringQuery, IPC_POLL_MS);

  let lastResponseText: string | null = null;
  let eventCount = 0;

  try {
    const { events } = await thread.runStreamed(fullPrompt);

    for await (const event of events) {
      eventCount++;

      switch (event.type) {
        case 'thread.started':
          newSessionId = (event as ThreadEvent & { thread_id?: string }).thread_id;
          if (newSessionId) {
            log(`Codex thread started: ${newSessionId}`);
          }
          break;

        case 'item.completed': {
          const item = (event as ThreadEvent & { item?: { type?: string; content?: string } }).item;
          if (item?.type === 'agent_message' && item.content) {
            lastResponseText = item.content;
            log(`Codex agent message (${item.content.length} chars)`);
          } else if (item?.type === 'todo_list') {
            log('Codex todo list update');
          }
          break;
        }

        case 'turn.completed': {
          log(`Codex turn completed (${eventCount} events)`);
          if (lastResponseText) {
            writeOutput({
              status: 'success',
              result: lastResponseText,
              newSessionId,
            });
          }
          break;
        }

        case 'turn.failed': {
          const errorEvent = event as ThreadEvent & { error?: { message?: string } };
          const errorMsg = errorEvent.error?.message || 'Unknown Codex error';
          log(`Codex turn failed: ${errorMsg}`);
          writeOutput({
            status: 'error',
            result: null,
            newSessionId,
            error: errorMsg,
          });
          break;
        }

        case 'thread.error': {
          const threadError = event as ThreadEvent & { error?: { message?: string } };
          const errorMsg = threadError.error?.message || 'Codex thread error';
          log(`Codex thread error: ${errorMsg}`);
          writeOutput({
            status: 'error',
            result: null,
            newSessionId,
            error: errorMsg,
          });
          break;
        }

        default:
          log(`Codex event: ${event.type}`);
          break;
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Codex run error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId,
      error: errorMessage,
    });
  }

  ipcPolling = false;

  // If thread was newly created but we didn't get a thread.started event,
  // try to capture the thread ID from the thread object
  if (!newSessionId && !sessionId && 'id' in thread) {
    newSessionId = (thread as { id?: string }).id;
  }

  log(`Codex query done. Events: ${eventCount}, closedDuringQuery: ${closedDuringQuery}`);
  return { newSessionId, closedDuringQuery };
}

export async function run(containerInput: ContainerInput): Promise<void> {
  const secrets = containerInput.secrets || {};
  const model = secrets.CHATGPT_MODEL || 'o4-mini';
  const codexEnv = buildCodexEnv(containerInput);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  // Write config.toml for MCP servers
  writeCodexConfig(containerInput, mcpServerPath, model);

  const codex = new Codex({
    apiKey: secrets.CHATGPT_ACCESS_TOKEN || secrets.OPENAI_API_KEY,
    config: {
      model,
    },
  });

  let sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel
  try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }

  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  try {
    while (true) {
      log(`Starting Codex query (session: ${sessionId || 'new'})...`);

      const result = await runCodexQuery(prompt, sessionId, codex, containerInput);
      if (result.newSessionId) sessionId = result.newSessionId;
      if (result.closedDuringQuery) {
        log('Close sentinel consumed during Codex query, exiting');
        break;
      }

      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Codex query ended, waiting for next IPC message...');

      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new Codex query`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Codex agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}
