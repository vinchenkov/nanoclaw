import fs from 'fs';
import path from 'path';

import { CODEX_MODEL, DATA_DIR } from './config.js';
import { logger } from './logger.js';

export type RuntimeKind = 'claude' | 'codex';

export interface RuntimeHooks {
  prepareHostState(groupFolder: string): void;
}

const claudeRuntime: RuntimeHooks = {
  prepareHostState(_groupFolder: string): void {
    // Claude state is already handled in buildVolumeMounts
  },
};

const codexRuntime: RuntimeHooks = {
  prepareHostState(groupFolder: string): void {
    const groupCodexDir = path.join(
      DATA_DIR,
      'sessions',
      groupFolder,
      '.codex',
    );
    fs.mkdirSync(path.join(groupCodexDir, 'sessions'), { recursive: true });

    // Copy shared auth from data/codex-auth/auth.json if it exists
    const sharedAuth = path.join(DATA_DIR, 'codex-auth', 'auth.json');
    if (fs.existsSync(sharedAuth)) {
      const destAuth = path.join(groupCodexDir, 'auth.json');
      fs.copyFileSync(sharedAuth, destAuth);
    }

    // Generate config.toml if CODEX_MODEL is set
    if (CODEX_MODEL) {
      const configPath = path.join(groupCodexDir, 'config.toml');
      fs.writeFileSync(
        configPath,
        `model = "${CODEX_MODEL}"\nsandbox_mode = "danger-full-access"\n`,
      );
    }
  },
};

export function getRuntime(kind: RuntimeKind): RuntimeHooks {
  if (kind === 'codex') return codexRuntime;
  return claudeRuntime;
}
