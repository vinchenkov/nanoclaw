/**
 * ChatGPT OAuth Token Auto-Refresh
 * Called before each container spawn when AGENT_SDK=codex.
 * Reads tokens from .env, checks JWT expiry, refreshes if needed.
 */

import fs from 'fs';
import path from 'path';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

const TOKEN_ENDPOINT = 'https://auth.openai.com/oauth/token';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh if <5 min remaining

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // Can't determine expiry, assume expired
  const expiresAt = payload.exp * 1000;
  return Date.now() + REFRESH_BUFFER_MS >= expiresAt;
}

function updateEnvFile(key: string, value: string): void {
  const envFile = path.join(process.cwd(), '.env');
  let content: string;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch {
    content = '';
  }

  const lines = content.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFile, lines.join('\n'));
}

export async function refreshTokenIfNeeded(): Promise<void> {
  const tokens = readEnvFile(['CHATGPT_ACCESS_TOKEN', 'CHATGPT_REFRESH_TOKEN']);
  const accessToken = tokens.CHATGPT_ACCESS_TOKEN;
  const refreshToken = tokens.CHATGPT_REFRESH_TOKEN;

  if (!accessToken) {
    logger.debug('No CHATGPT_ACCESS_TOKEN set, skipping refresh');
    return;
  }

  if (!isTokenExpiringSoon(accessToken)) {
    logger.debug('ChatGPT access token still valid');
    return;
  }

  if (!refreshToken) {
    logger.warn('ChatGPT access token expiring but no CHATGPT_REFRESH_TOKEN available');
    return;
  }

  logger.info('Refreshing ChatGPT access token...');

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (data.access_token) {
    updateEnvFile('CHATGPT_ACCESS_TOKEN', data.access_token);
    logger.info('ChatGPT access token refreshed');
  }
  if (data.refresh_token) {
    updateEnvFile('CHATGPT_REFRESH_TOKEN', data.refresh_token);
  }
}
