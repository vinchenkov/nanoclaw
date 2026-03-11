/**
 * Step: codex-auth — Set up Codex SDK authentication.
 *
 * Two modes:
 *   --with-api-key   Reads an OpenAI API key from stdin and writes it to .env
 *   (default)        Runs `codex login` browser OAuth flow, then copies the
 *                    resulting auth.json into data/codex-auth/ for container use.
 *
 * Usage:
 *   npx tsx setup/index.ts --step codex-auth
 *   npx tsx setup/index.ts --step codex-auth --with-api-key
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

import { DATA_DIR } from '../src/config.js';
import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

const CODEX_AUTH_DIR = path.join(DATA_DIR, 'codex-auth');
const CODEX_HOME = path.join(os.homedir(), '.codex');

function ensureCodexInstalled(): boolean {
  try {
    execSync('codex --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function promptLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runApiKeyMode(): Promise<void> {
  const key = await promptLine('Enter your OpenAI API key: ');
  if (!key.startsWith('sk-')) {
    console.error('Invalid API key format (expected sk-...)');
    process.exit(1);
  }

  // Write to .env
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Replace or append CODEX_API_KEY
  if (envContent.includes('CODEX_API_KEY=')) {
    envContent = envContent.replace(/^CODEX_API_KEY=.*$/m, `CODEX_API_KEY=${key}`);
  } else {
    envContent = envContent.trimEnd() + `\nCODEX_API_KEY=${key}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('CODEX_API_KEY written to .env');
  console.log('The key will be passed to containers as a secret (never written to disk inside containers).');

  emitStatus('CODEX_AUTH', {
    STATUS: 'ok',
    METHOD: 'api_key',
  });
}

async function runOAuthMode(): Promise<void> {
  if (!ensureCodexInstalled()) {
    console.error(
      'Codex CLI not found. Install it first:\n  npm install -g @openai/codex',
    );
    process.exit(1);
  }

  console.log('Starting Codex OAuth login flow...');
  console.log('A browser window will open for authentication.\n');

  // Run `codex login` which handles the OAuth browser flow
  const result = spawnSync('codex', ['login'], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('Codex login failed');
    process.exit(1);
  }

  // Copy auth.json from ~/.codex/ to data/codex-auth/
  const sourceAuth = path.join(CODEX_HOME, 'auth.json');
  if (!fs.existsSync(sourceAuth)) {
    console.error(
      `auth.json not found at ${sourceAuth} after login.`,
    );
    console.error(
      'The Codex CLI may have stored credentials in the system keychain instead.',
    );
    console.error(
      'Try using --with-api-key mode instead, or check ~/.codex/ manually.',
    );
    process.exit(1);
  }

  fs.mkdirSync(CODEX_AUTH_DIR, { recursive: true });
  const destAuth = path.join(CODEX_AUTH_DIR, 'auth.json');
  fs.copyFileSync(sourceAuth, destAuth);
  // Restrict permissions — this file contains tokens
  fs.chmodSync(destAuth, 0o600);

  console.log(`\nAuth tokens copied to ${destAuth}`);
  console.log('Tokens will be materialized into each group container at startup.');

  emitStatus('CODEX_AUTH', {
    STATUS: 'ok',
    METHOD: 'oauth',
    AUTH_PATH: destAuth,
  });
}

export async function run(args: string[]): Promise<void> {
  logger.info('Starting Codex authentication setup');

  if (args.includes('--with-api-key')) {
    await runApiKeyMode();
  } else {
    await runOAuthMode();
  }
}
