import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

function runMc(baseDir: string, args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(process.cwd(), 'groups/shared/bin/mc.ts'),
        '--base-dir',
        baseDir,
        ...args,
      ],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `mc exited with code ${code}`));
        return;
      }

      resolve(JSON.parse(stdout));
    });
  });
}

describe('mc task create', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('serializes concurrent initiative task creation so IDs and initiative links stay unique', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mc-test-'));
    tempDirs.push(baseDir);

    mkdirSync(join(baseDir, 'mission-control'), { recursive: true });

    await runMc(baseDir, [
      'initiative',
      'create',
      '--title',
      'Concurrent Initiative',
      '--goal',
      'Prove concurrent task creation is safe',
      '--objective',
      'other',
    ]);

    const initiativeId = 'I-CONCURRENT-INITIATIVE';
    const [first, second] = await Promise.all([
      runMc(baseDir, [
        'task',
        'create',
        '--title',
        'First concurrent task',
        '--description',
        'First',
        '--worker-type',
        'ops',
        '--initiative',
        initiativeId,
        '--acceptance-criterion',
        'done',
      ]),
      runMc(baseDir, [
        'task',
        'create',
        '--title',
        'Second concurrent task',
        '--description',
        'Second',
        '--worker-type',
        'ops',
        '--initiative',
        initiativeId,
        '--acceptance-criterion',
        'done',
      ]),
    ]);

    expect(first).toMatchObject({ id: expect.stringMatching(/^I-\d{3}-/) });
    expect(second).toMatchObject({ id: expect.stringMatching(/^I-\d{3}-/) });
    expect((first as { id: string }).id).not.toBe(
      (second as { id: string }).id,
    );

    const initiativeFile = readFileSync(
      join(baseDir, 'mission-control', 'initiatives', `${initiativeId}.md`),
      'utf8',
    );
    expect(initiativeFile).toContain((first as { id: string }).id);
    expect(initiativeFile).toContain((second as { id: string }).id);
  });

  it('stores structured acceptance criteria on task create and returns them on get', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mc-test-'));
    tempDirs.push(baseDir);

    mkdirSync(join(baseDir, 'mission-control'), { recursive: true });

    const created = (await runMc(baseDir, [
      'task',
      'create',
      '--title',
      'Create structured task',
      '--description',
      'Write the audit to /workspace/extra/shared/mission-control/outputs/structured-task.md.',
      '--acceptance-criterion',
      'Includes a complete audit',
      '--acceptance-criterion',
      'Cites concrete repo evidence',
      '--worker-type',
      'research',
    ])) as { id: string };

    const task = (await runMc(baseDir, ['task', 'get', created.id])) as {
      acceptance_criteria: Array<{ description: string; done: boolean }>;
    };

    expect(task.acceptance_criteria).toEqual([
      { description: 'Includes a complete audit', done: false },
      { description: 'Cites concrete repo evidence', done: false },
    ]);
  });

  it('rejects task creation when the structured field is empty', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'mc-test-'));
    tempDirs.push(baseDir);

    mkdirSync(join(baseDir, 'mission-control'), { recursive: true });

    await expect(
      runMc(baseDir, [
        'task',
        'create',
        '--title',
        'Bad task',
        '--description',
        'Do the work. Acceptance criteria: 1) first thing, 2) second thing.',
        '--worker-type',
        'research',
      ]),
    ).rejects.toThrow(
      /Task requires at least one structured acceptance_criteria/i,
    );
  });
});
