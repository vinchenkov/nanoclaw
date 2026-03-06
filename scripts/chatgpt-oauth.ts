#!/usr/bin/env npx tsx
/**
 * ChatGPT OAuth PKCE Token Acquisition
 * Run manually: npx tsx scripts/chatgpt-oauth.ts
 *
 * Opens browser to OpenAI auth page, exchanges code for tokens,
 * writes CHATGPT_ACCESS_TOKEN and CHATGPT_REFRESH_TOKEN to .env.
 *
 * Uses the ChatGPT web client ID with PKCE flow.
 * NOTE: This uses an unofficial client ID. Token refresh could break without notice.
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTH_BASE = 'https://auth.openai.com';
const REDIRECT_URI = 'http://127.0.0.1:1455/auth/callback';
const SCOPES = 'model.request api.model.read';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function updateEnvFile(updates: Record<string, string>): void {
  const envFile = path.join(process.cwd(), '.env');
  let content: string;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch {
    content = '';
  }

  const lines = content.split('\n');

  for (const [key, value] of Object.entries(updates)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`${key}=`)) {
        lines[i] = `${key}=${value}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envFile, lines.join('\n'));
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
      ? `start "${url}"`
      : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`\nCould not open browser automatically. Please open this URL:\n${url}\n`);
    }
  });
}

async function main(): Promise<void> {
  // Generate PKCE verifier and challenge
  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  const authUrl = new URL(`${AUTH_BASE}/oauth/authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('Starting ChatGPT OAuth flow...');
  console.log('A browser window will open. Log in with your ChatGPT Plus account.\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/auth/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1:1455`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authentication failed</h1><p>${error}</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing authorization code</h1>');
        return;
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(`${AUTH_BASE}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
          }),
        });

        if (!tokenResponse.ok) {
          const body = await tokenResponse.text();
          throw new Error(`Token exchange failed (${tokenResponse.status}): ${body}`);
        }

        const tokens = (await tokenResponse.json()) as {
          access_token: string;
          refresh_token?: string;
        };

        const updates: Record<string, string> = {
          CHATGPT_ACCESS_TOKEN: tokens.access_token,
        };
        if (tokens.refresh_token) {
          updates.CHATGPT_REFRESH_TOKEN = tokens.refresh_token;
        }

        updateEnvFile(updates);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');

        console.log('Tokens written to .env:');
        console.log('  CHATGPT_ACCESS_TOKEN = (set)');
        if (tokens.refresh_token) {
          console.log('  CHATGPT_REFRESH_TOKEN = (set)');
        }
        console.log('\nDone! You can now set AGENT_SDK=codex in .env to use the Codex SDK.');

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Token exchange failed</h1><p>${err}</p>`);
        server.close();
        reject(err);
      }
    });

    server.listen(1455, '127.0.0.1', () => {
      console.log('Listening on http://127.0.0.1:1455 for OAuth callback...\n');
      openBrowser(authUrl.toString());
    });

    server.on('error', (err) => {
      reject(new Error(`Server error: ${err.message}. Is port 1455 already in use?`));
    });
  });
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
