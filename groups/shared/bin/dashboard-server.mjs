#!/usr/bin/env node

import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = 'true';
    }
  }
  return flags;
}

function resolveRoot(baseDirFlag) {
  if (baseDirFlag) return resolve(baseDirFlag);

  const sharedRoot = resolve(__dirname, '..');
  if (existsSync(join(sharedRoot, 'mission-control'))) return sharedRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, 'mission-control'))) return cwd;

  return cwd;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const [, fmRaw, body] = match;
  const frontmatter = {};
  for (const line of fmRaw.split('\n')) {
    if (!line || line.startsWith(' ') || line.startsWith('-')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    frontmatter[key] = parseScalar(line.slice(idx + 1));
  }
  return { frontmatter, body };
}

function safeReadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseTask(path) {
  const raw = readFileSync(path, 'utf8');
  const { frontmatter } = parseFrontmatter(raw);
  const rawStatus = String(frontmatter.status ?? 'ready');
  const status = rawStatus === 'backlog' ? 'ready' : rawStatus;
  return {
    id: String(frontmatter.id ?? ''),
    title: String(frontmatter.title ?? ''),
    status,
    priority: String(frontmatter.priority ?? 'P2'),
    worker_type: String(frontmatter.worker_type ?? 'ops'),
    origin: String(frontmatter.origin ?? 'user'),
    initiative: frontmatter.initiative == null || frontmatter.initiative === '' ? null : String(frontmatter.initiative),
    description: frontmatter.description ? String(frontmatter.description) : '',
    acceptance_criteria: Array.isArray(frontmatter.acceptance_criteria) ? frontmatter.acceptance_criteria : [],
    outputs: Array.isArray(frontmatter.outputs) ? frontmatter.outputs : [],
    depends_on: Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [],
    retry_count: Number(frontmatter.retry_count ?? 0),
    revision_count: Number(frontmatter.revision_count ?? 0),
    blocked_reason: frontmatter.blocked_reason == null || frontmatter.blocked_reason === '' ? null : String(frontmatter.blocked_reason),
    failure_reason: frontmatter.failure_reason == null || frontmatter.failure_reason === '' ? null : String(frontmatter.failure_reason),
    cancellation_reason: frontmatter.cancellation_reason == null || frontmatter.cancellation_reason === '' ? null : String(frontmatter.cancellation_reason),
    created_at: frontmatter.created_at ? String(frontmatter.created_at) : null,
    started_at: frontmatter.started_at ? String(frontmatter.started_at) : null,
    completed_at: frontmatter.completed_at ? String(frontmatter.completed_at) : null,
    updated_at: frontmatter.updated_at ? String(frontmatter.updated_at) : null,
    due: frontmatter.due ? String(frontmatter.due) : null,
    project: frontmatter.project ?? null,
  };
}

function parseInitiative(path) {
  const raw = readFileSync(path, 'utf8');
  const { frontmatter } = parseFrontmatter(raw);
  return {
    id: String(frontmatter.id ?? ''),
    title: String(frontmatter.title ?? ''),
    status: String(frontmatter.status ?? 'active'),
    objective: String(frontmatter.objective ?? 'other'),
    goal: String(frontmatter.goal ?? ''),
    timeframe: String(frontmatter.timeframe ?? ''),
    tasks: Array.isArray(frontmatter.tasks) ? frontmatter.tasks : [],
    created_at: frontmatter.created_at ? String(frontmatter.created_at) : null,
    updated_at: frontmatter.updated_at ? String(frontmatter.updated_at) : null,
  };
}

function readTasks(root) {
  const dir = join(root, 'mission-control', 'tasks');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      try {
        return parseTask(join(dir, name));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
}

function readInitiatives(root) {
  const dir = join(root, 'mission-control', 'initiatives');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      try {
        return parseInitiative(join(dir, name));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
}

function readLock(root) {
  return safeReadJson(join(root, 'mission-control', 'lock.json'), { locked: false });
}

function readActivity(root, limit = 200) {
  const path = join(root, 'mission-control', 'activity.log.ndjson');
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-Math.max(1, Math.min(limit, 5000)));

  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore malformed lines.
    }
  }
  return events.reverse();
}

function buildSummary(tasks, initiatives, lock) {
  const statusCounts = {};
  const priorityCounts = {};

  for (const task of tasks) {
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
    priorityCounts[task.priority] = (priorityCounts[task.priority] ?? 0) + 1;
  }

  return {
    tasks_total: tasks.length,
    initiatives_total: initiatives.length,
    lock,
    status_counts: statusCounts,
    priority_counts: priorityCounts,
    ready_tasks: tasks.filter((task) => task.status === 'ready').length,
    blocked_tasks: tasks.filter((task) => task.status === 'blocked').length,
    in_progress_tasks: tasks.filter((task) => task.status === 'in_progress').length,
  };
}

// Write logic adapted from mc.ts
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withFileLock(name, root, fn) {
  const dir = join(root, 'mission-control', '.mc-locks', name);
  mkdirSync(join(root, 'mission-control', '.mc-locks'), { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      mkdirSync(dir, { recursive: false });
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - startedAt > 5000) throw new Error(`Timed out waiting for lock: ${name}`);
      sleepMs(50);
    }
  }
  writeFileSync(join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, created_at: Date.now() }));
  try {
    return fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function fmtVal(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return JSON.stringify(v);
  return String(v);
}

function renderNewTaskFile(task) {
  return [
    '---',
    `id: ${task.id}`,
    `title: ${JSON.stringify(task.title)}`,
    `status: ${task.status}`,
    `priority: ${task.priority}`,
    `worker_type: ${task.worker_type}`,
    `origin: ${task.origin}`,
    `initiative: ${fmtVal(task.initiative)}`,
    `description: ${JSON.stringify(task.description)}`,
    `acceptance_criteria: ${JSON.stringify(task.acceptance_criteria)}`,
    `outputs: ${JSON.stringify(task.outputs)}`,
    `project: ${fmtVal(task.project)}`,
    `depends_on: ${JSON.stringify(task.depends_on)}`,
    `retry_count: ${task.retry_count}`,
    `revision_count: ${task.revision_count}`,
    `blocked_reason: ${fmtVal(task.blocked_reason)}`,
    `failure_reason: ${fmtVal(task.failure_reason)}`,
    `cancellation_reason: ${fmtVal(task.cancellation_reason)}`,
    `created_at: ${task.created_at}`,
    `started_at: ${fmtVal(task.started_at)}`,
    `completed_at: ${fmtVal(task.completed_at)}`,
    `updated_at: ${task.updated_at}`,
    `due: ${fmtVal(task.due)}`,
    '---',
    '',
  ].join('\n');
}

function renderLegacyTaskFile(task, body) {
  const fm = [
    '---',
    `id: ${task.id}`,
    `title: ${JSON.stringify(task.title)}`,
    `status: ${task.status}`,
    `origin: ${task.origin}`,
    `priority: ${task.priority}`,
    `worker_type: ${task.worker_type}`,
    `created_at: ${task.created_at}`,
    `updated_at: ${task.updated_at}`,
    `started_at: ${fmtVal(task.started_at)}`,
    `completed_at: ${fmtVal(task.completed_at)}`,
    `due: ${fmtVal(task.due)}`,
    `cancellation_reason: ${fmtVal(task.cancellation_reason)}`,
    `blocked_reason: ${fmtVal(task.blocked_reason)}`,
    `failure_reason: ${fmtVal(task.failure_reason)}`,
    `retry_count: ${task.retry_count}`,
    `revision_count: ${task.revision_count}`,
    `project: ${task.project != null ? JSON.stringify(task.project) : ''}`,
    `depends_on: ${JSON.stringify(task.depends_on)}`,
    `outputs: ${JSON.stringify(task.outputs)}`,
    ...(task.initiative ? [`initiative: ${task.initiative}`] : []),
    '---',
    '',
  ].join('\n');
  return `${fm}${body.trim()}\n`;
}

function renderInitiativeFrontmatter(initiative) {
  return [
    '---',
    `id: ${initiative.id}`,
    `title: ${JSON.stringify(initiative.title)}`,
    `status: ${initiative.status}`,
    `objective: ${initiative.objective}`,
    `goal: ${JSON.stringify(initiative.goal)}`,
    `timeframe: ${JSON.stringify(initiative.timeframe)}`,
    `tasks: ${JSON.stringify(initiative.tasks)}`,
    `created_at: ${initiative.created_at}`,
    `updated_at: ${initiative.updated_at}`,
    '---',
    '',
  ].join('\n');
}

function appendActivityLog(event, root) {
  const logPath = join(root, 'mission-control', 'activity.log.ndjson');
  appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), actor: 'dashboard', ...event }) + '\n');
}

function nextStandaloneTaskId(tasks) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const maxSeq = tasks
    .filter((t) => t.id.startsWith(`T-${day}-`))
    .map((t) => Number(t.id.slice(-4)))
    .reduce((max, n) => Math.max(max, Number.isFinite(n) ? n : 0), 0);
  return `T-${day}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function nextInitiativeTaskSeq(tasks) {
  const maxSeq = tasks
    .filter((t) => /^I-\d{3}-/.test(t.id))
    .map((t) => Number(t.id.slice(2, 5)))
    .reduce((max, n) => Math.max(max, Number.isFinite(n) ? n : 0), 0);
  return String(maxSeq + 1).padStart(3, '0');
}

function titleToKebabUpper(title) {
  return title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function initiativeIdFromTitle(title) {
  return `I-${titleToKebabUpper(title)}`;
}

function initiativeTaskId(seq, title) {
  return `I-${seq}-${titleToKebabUpper(title)}`;
}

function json(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function text(res, code, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'content-type': contentType });
  res.end(body);
}

function escapeHtml(raw) {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function dashboardHtml(baseDir, mcPath) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mission Control</title>
    <style>
      :root {
        --bg: #0d1117;
        --surface: #161b22;
        --card: #1c2333;
        --text: #e6edf3;
        --muted: #8b949e;
        --border: #30363d;
        --ok: #3fb950;
        --warn: #d29922;
        --danger: #f85149;
        --accent: #388bfd;
        --col-radius: 8px;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        color: var(--text);
        background: var(--bg);
        padding: 16px 24px;
      }

      /* Header */
      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .header-left h1 {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .header-left .status {
        font-size: 13px;
        font-weight: 600;
        margin-top: 2px;
      }
      .header-left .status .dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 5px;
        vertical-align: middle;
      }
      .header-left .status.active { color: var(--ok); }
      .header-left .status.active .dot { background: var(--ok); }
      .header-left .status.locked { color: var(--danger); }
      .header-left .status.locked .dot { background: var(--danger); }
      .header-right {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .worker-status {
        color: var(--muted);
        font-size: 13px;
      }
      .btn-emergency {
        background: transparent;
        color: var(--danger);
        border: 2px solid var(--danger);
        border-radius: 6px;
        padding: 6px 16px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        letter-spacing: 0.3px;
      }
      .btn-emergency:hover { background: rgba(248,81,73,0.15); }

      /* Tabs */
      .tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--border);
        margin-bottom: 8px;
      }
      .tab {
        padding: 8px 16px;
        font-size: 14px;
        color: var(--muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        font-family: inherit;
      }
      .tab:hover { color: var(--text); }
      .tab.active {
        color: var(--text);
        border-bottom-color: var(--text);
        font-weight: 600;
      }

      /* Toolbar */
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .toolbar-label {
        font-size: 13px;
        color: var(--muted);
      }
      .btn-new {
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-new:hover { background: #4d9eff; }

      /* Kanban board */
      .board {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .column {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--col-radius);
        min-height: 180px;
        display: flex;
        flex-direction: column;
      }
      .column-header {
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        color: var(--text);
      }
      .column-body {
        flex: 1;
        padding: 4px 10px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .task-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 10px 11px;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .task-card .task-title {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.35;
      }
      .task-card .task-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .task-card .task-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .task-card .task-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.25px;
        text-transform: uppercase;
      }
      .task-card .task-badge.priority {
        background: rgba(210,153,34,0.16);
        color: #f3c86a;
      }
      .task-card .task-badge.status {
        background: rgba(56,139,253,0.16);
        color: #7cb7ff;
      }
      .task-card .task-meta {
        color: var(--muted);
        font-size: 11px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .task-card .task-worker {
        text-transform: capitalize;
      }
      .task-card .task-blocked-reason {
        color: var(--danger);
        font-size: 11px;
        font-style: italic;
        margin-top: -2px;
        line-height: 1.3;
      }

      /* Initiatives view */
      .initiatives-view { display: none; }
      .initiatives-view.active { display: block; }
      .tasks-view.active { display: block; }
      .tasks-view { display: none; }
      .initiatives-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .board.initiatives-board {
        grid-template-columns: repeat(4, 1fr);
      }
      .initiative-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 11px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .initiative-card .init-title {
        font-weight: 700;
        font-size: 14px;
        line-height: 1.35;
      }
      .initiative-card .init-meta {
        color: var(--muted);
        font-size: 11px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .initiative-card .init-goal {
        font-size: 13px;
        color: var(--text);
        opacity: 0.85;
      }
      .column-empty {
        color: var(--muted);
        font-size: 12px;
        padding: 10px 2px 4px;
      }

      /* Activity feed */
      .activity-section {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--col-radius);
      }
      .activity-header {
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 700;
      }
      .activity-body {
        padding: 6px 14px 14px;
      }
      .activity-row {
        display: flex;
        gap: 12px;
        padding: 5px 0;
        font-size: 12px;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
      }
      .activity-row:last-child { border-bottom: none; }
      .activity-time { color: var(--muted); white-space: nowrap; min-width: 140px; }
      .activity-actor {
        font-family: ui-monospace, Menlo, Consolas, monospace;
        color: var(--text);
        background: rgba(148, 163, 184, 0.12);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 999px;
        padding: 1px 8px;
        white-space: nowrap;
        min-width: 72px;
        text-align: center;
      }
      .activity-event { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--accent); min-width: 140px; }
      .activity-target { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--muted); min-width: 120px; }
      .activity-detail { color: var(--text); opacity: 0.8; flex: 1 1 260px; }

      /* Detail sidebar */
      .sidebar-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 99;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      .sidebar-overlay.open { opacity: 1; pointer-events: auto; }
      .sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 480px;
        max-width: 95vw;
        height: 100vh;
        background: var(--surface);
        border-left: 1px solid var(--border);
        z-index: 100;
        transform: translateX(100%);
        transition: transform 0.25s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .sidebar.open { transform: translateX(0); }
      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }
      .sidebar-header h2 {
        font-size: 15px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-close {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .sidebar-close:hover { color: var(--text); }
      .sidebar-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
      }
      .detail-section {
        margin-bottom: 16px;
      }
      .detail-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .detail-field {
        background: var(--card);
        border-radius: 6px;
        padding: 8px 10px;
      }
      .detail-field.full { grid-column: 1 / -1; }
      .detail-field-label {
        font-size: 11px;
        color: var(--muted);
        margin-bottom: 2px;
      }
      .detail-field-value {
        font-size: 13px;
        word-break: break-word;
      }
      .detail-field-value.mono {
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 12px;
      }
      .criteria-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .criteria-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: var(--card);
        border-radius: 6px;
        padding: 9px 10px;
      }
      .criteria-check {
        font-size: 12px;
        line-height: 1.4;
        color: var(--muted);
        min-width: 14px;
      }
      .criteria-item.done .criteria-check {
        color: var(--ok);
      }
      .criteria-text {
        font-size: 13px;
        line-height: 1.45;
        color: var(--text);
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }
      .badge-status { background: rgba(56,139,253,0.15); color: var(--accent); }
      .badge-priority { background: rgba(210,153,34,0.15); color: var(--warn); }
      .badge-ok { background: rgba(63,185,80,0.15); color: var(--ok); }
      .badge-danger { background: rgba(248,81,73,0.15); color: var(--danger); }
      .task-card, .initiative-card { cursor: pointer; transition: border-color 0.15s; }
      .task-card:hover, .initiative-card:hover { border-color: var(--accent); }

      /* Form controls */
      label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
      input, select, textarea {
        width: 100%;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text);
        padding: 8px 10px;
        font-size: 13px;
        margin-bottom: 12px;
      }
      input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
      .form-actions { display: flex; gap: 10px; margin-top: 10px; }
      .btn-save { background: var(--ok); color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; flex: 1; }
      .btn-save:hover { background: #46c95d; }
      .btn-cancel { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 8px 16px; cursor: pointer; }
      .btn-cancel:hover { background: var(--card); }

      @media (max-width: 900px) {
        .board { grid-template-columns: 1fr 1fr; }
        .board.initiatives-board { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 500px) {
        .board { grid-template-columns: 1fr; }
        .board.initiatives-board { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="header-left">
        <h1>Mission Control</h1>
        <div id="system-status" class="status active"><span class="dot"></span>ACTIVE</div>
      </div>
      <div class="header-right">
        <span id="worker-status" class="worker-status">No active worker</span>
        <button class="btn-emergency" id="btn-estop">&#9632; EMERGENCY STOP</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-view="tasks">Tasks</button>
      <button class="tab" data-view="initiatives">Initiatives</button>
    </div>

    <div class="tasks-view active" id="tasks-view">
      <div class="toolbar">
        <span class="toolbar-label">Live board and feed</span>
        <button class="btn-new" id="btn-new-task">+ New Task</button>
      </div>

      <div class="board" id="board">
        <div class="column">
          <div class="column-header" id="col-ready">READY (0)</div>
          <div class="column-body" id="col-ready-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="col-in_progress">IN PROGRESS (0)</div>
          <div class="column-body" id="col-in_progress-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="col-blocked">BLOCKED (0)</div>
          <div class="column-body" id="col-blocked-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="col-done">DONE (0)</div>
          <div class="column-body" id="col-done-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="col-verified">VERIFIED (0)</div>
          <div class="column-body" id="col-verified-body"></div>
        </div>
      </div>
    </div>

    <div class="initiatives-view" id="initiatives-view">
      <div class="initiatives-toolbar">
        <span class="toolbar-label">Grouped by initiative lifecycle</span>
        <button class="btn-new" id="btn-new-initiative">+ New Initiative</button>
      </div>

      <div class="board initiatives-board">
        <div class="column">
          <div class="column-header" id="initiative-col-active">IN PROGRESS (0)</div>
          <div class="column-body" id="initiative-col-active-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="initiative-col-paused">PAUSED (0)</div>
          <div class="column-body" id="initiative-col-paused-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="initiative-col-complete">DONE (0)</div>
          <div class="column-body" id="initiative-col-complete-body"></div>
        </div>
        <div class="column">
          <div class="column-header" id="initiative-col-archived">ARCHIVED (0)</div>
          <div class="column-body" id="initiative-col-archived-body"></div>
        </div>
      </div>
    </div>

    <div class="activity-section">
      <div class="activity-header">Activity Feed</div>
      <div class="activity-body" id="activity"></div>
    </div>

    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h2 id="sidebar-title">Details</h2>
        <button class="sidebar-close" id="sidebar-close">&times;</button>
      </div>
      <div class="sidebar-body" id="sidebar-body"></div>
    </div>

    <script>
      const STATUS_COLUMNS = {
        ready: 'ready',
        in_progress: 'in_progress',
        blocked: 'blocked',
        done: 'done',
        verified: 'verified',
        failed: 'blocked',
        cancelled: 'done',
      };

      const COLUMN_LABELS = {
        ready: 'READY',
        in_progress: 'IN PROGRESS',
        blocked: 'BLOCKED',
        done: 'DONE',
        verified: 'VERIFIED',
      };

      const INITIATIVE_COLUMN_LABELS = {
        active: 'IN PROGRESS',
        paused: 'PAUSED',
        complete: 'DONE',
        archived: 'ARCHIVED',
      };

      const OBJECTIVES = ['projectcal', 'robotics', 'ai-writing', 'north-star', 'other'];
      const WORKER_TYPES = ['coding', 'research', 'writing', 'long', 'ops', 'admin'];
      const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

      var currentTasks = [];
      var currentInitiatives = [];

      async function fetchJson(path) {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) throw new Error(path + ' -> ' + response.status);
        return response.json();
      }

      async function postJson(path, payload, method = 'POST') {
        const response = await fetch(path, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || 'Action failed');
        }
        return response.json();
      }

      function fmtDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      function fmtShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      function escapeHtml(value) {
        return String(value == null ? '' : value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function renderEmptyState(label) {
        return '<div class="column-empty">' + escapeHtml(label) + '</div>';
      }

      function renderActivityRow(event) {
        return '<div class="activity-row">' +
          '<span class="activity-time">' + fmtShortDate(event.ts) + '</span>' +
          '<span class="activity-actor">' + escapeHtml(event.actor || 'unknown') + '</span>' +
          '<span class="activity-event">' + escapeHtml(event.event || '') + '</span>' +
          '<span class="activity-target">' + escapeHtml(event.task_id || event.initiative_id || '') + '</span>' +
          '<span class="activity-detail">' + escapeHtml(event.detail || '') + '</span>' +
        '</div>';
      }

      function renderTaskCard(task) {
        return '<div class="task-card" data-type="task" data-id="' + task.id + '">' +
          '<div class="task-row">' +
            '<div class="task-title">' + escapeHtml(task.title || task.id) + '</div>' +
            '<div class="task-badges">' +
              (task.priority ? '<span class="task-badge priority">' + escapeHtml(task.priority) + '</span>' : '') +
            '</div>' +
          '</div>' +
          (task.status === 'blocked' && task.blocked_reason ? '<div class="task-blocked-reason">' + escapeHtml(task.blocked_reason) + '</div>' : '') +
          (task.status === 'failed' && task.failure_reason ? '<div class="task-blocked-reason">' + escapeHtml(task.failure_reason) + '</div>' : '') +
          '<div class="task-meta">' +
            (task.worker_type ? '<span class="task-worker">' + escapeHtml(task.worker_type) + '</span>' : '') +
          '</div>' +
        '</div>';
      }

      function renderInitiativeCard(init) {
        const taskCount = init.tasks ? init.tasks.length : 0;
        return '<div class="initiative-card" data-type="initiative" data-id="' + init.id + '">' +
          '<div class="init-title">' + escapeHtml(init.title || init.id) + '</div>' +
          '<div class="init-meta">' +
            '<span>' + escapeHtml(init.objective || 'other') + '</span>' +
            (init.timeframe ? '<span>' + escapeHtml(init.timeframe) + '</span>' : '') +
            '<span>' + taskCount + ' task' + (taskCount === 1 ? '' : 's') + '</span>' +
          '</div>' +
          (init.goal ? '<div class="init-goal">' + escapeHtml(init.goal) + '</div>' : '') +
        '</div>';
      }

      async function refresh() {
        const [summary, tasks, initiatives, lock, activity] = await Promise.all([
          fetchJson('/api/summary'),
          fetchJson('/api/tasks'),
          fetchJson('/api/initiatives'),
          fetchJson('/api/lock'),
          fetchJson('/api/activity?limit=25'),
        ]);

        currentTasks = tasks;
        currentInitiatives = initiatives;

        // System status
        const statusEl = document.getElementById('system-status');
        if (lock && lock.locked) {
          statusEl.className = 'status locked';
          statusEl.innerHTML = '<span class="dot"></span>LOCKED';
        } else {
          statusEl.className = 'status active';
          statusEl.innerHTML = '<span class="dot"></span>ACTIVE';
        }

        // Worker status
        const workerEl = document.getElementById('worker-status');
        if (lock && lock.locked) {
          workerEl.textContent = 'Worker: ' + (lock.owner || 'unknown') + ' on ' + (lock.task_id || '?');
        } else {
          workerEl.textContent = 'No active worker';
        }

        // Kanban columns
        const buckets = { ready: [], in_progress: [], blocked: [], done: [], verified: [] };
        for (const task of tasks) {
          const col = STATUS_COLUMNS[task.status] || 'ready';
          buckets[col].push(task);
        }
        for (const [key, label] of Object.entries(COLUMN_LABELS)) {
          document.getElementById('col-' + key).textContent = label + ' (' + buckets[key].length + ')';
          document.getElementById('col-' + key + '-body').innerHTML = buckets[key].length === 0
            ? renderEmptyState('No tasks')
            : buckets[key].map(renderTaskCard).join('');
        }

        // Initiatives view
        const initiativeBuckets = { active: [], paused: [], complete: [], archived: [] };
        for (const init of initiatives) {
          const key = Object.prototype.hasOwnProperty.call(initiativeBuckets, init.status) ? init.status : 'active';
          initiativeBuckets[key].push(init);
        }
        for (const [key, label] of Object.entries(INITIATIVE_COLUMN_LABELS)) {
          document.getElementById('initiative-col-' + key).textContent = label + ' (' + initiativeBuckets[key].length + ')';
          document.getElementById('initiative-col-' + key + '-body').innerHTML = initiativeBuckets[key].length === 0
            ? renderEmptyState('No initiatives')
            : initiativeBuckets[key].map(renderInitiativeCard).join('');
        }

        // Activity feed
        document.getElementById('activity').innerHTML = activity.length === 0
          ? '<div style="color:var(--muted);font-size:13px;padding:8px 0;">No activity yet.</div>'
          : activity.map(renderActivityRow).join('');
      }

      // Tab switching
      document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          const view = tab.getAttribute('data-view');
          document.getElementById('tasks-view').classList.toggle('active', view === 'tasks');
          document.getElementById('initiatives-view').classList.toggle('active', view === 'initiatives');
        });
      });

      // Sidebar logic
      var sidebarEl = document.getElementById('sidebar');
      var overlayEl = document.getElementById('sidebar-overlay');
      var sidebarTitleEl = document.getElementById('sidebar-title');
      var sidebarBodyEl = document.getElementById('sidebar-body');

      function closeSidebar() {
        sidebarEl.classList.remove('open');
        overlayEl.classList.remove('open');
      }

      document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
      overlayEl.addEventListener('click', closeSidebar);
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSidebar(); });

      function statusBadgeClass(status) {
        if (status === 'done' || status === 'verified' || status === 'complete') return 'badge-ok';
        if (status === 'blocked' || status === 'failed') return 'badge-danger';
        return 'badge-status';
      }

      function field(label, value, opts) {
        opts = opts || {};
        var cls = 'detail-field' + (opts.full ? ' full' : '');
        var valCls = 'detail-field-value' + (opts.mono ? ' mono' : '');
        var rendered = value;
        if (opts.badge) rendered = '<span class="badge ' + opts.badge + '">' + value + '</span>';
        else if (opts.date) rendered = fmtDate(value) || '<span style="color:var(--muted)">—</span>';
        if (!value && !opts.date) rendered = '<span style="color:var(--muted)">—</span>';
        return '<div class="' + cls + '"><div class="detail-field-label">' + label + '</div><div class="' + valCls + '">' + rendered + '</div></div>';
      }

      function renderAcceptanceCriteria(criteria) {
        if (!criteria || criteria.length === 0) return '';
        return '<div class="detail-section"><div class="detail-section-title">Acceptance Criteria</div><div class="criteria-list">' +
          criteria.map(function(item) {
            var done = !!(item && item.done);
            var description = item && item.description ? item.description : '';
            return '<div class="criteria-item' + (done ? ' done' : '') + '">' +
              '<span class="criteria-check">' + (done ? '&#10003;' : '&#9675;') + '</span>' +
              '<div class="criteria-text">' + escapeHtml(description) + '</div>' +
            '</div>';
          }).join('') +
        '</div></div>';
      }

      function renderTaskDetail(task) {
        sidebarTitleEl.textContent = task.title || task.id;
        var html = '';

        html += '<div class="detail-section"><div class="detail-section-title">Overview</div><div class="detail-grid">';
        html += field('ID', task.id, { mono: true, full: true });
        html += field('Status', task.status, { badge: statusBadgeClass(task.status) });
        html += field('Priority', task.priority, { badge: 'badge-priority' });
        html += field('Worker Type', task.worker_type);
        html += '</div></div>';

        if (task.status === 'blocked' && task.blocked_reason) {
          html += '<div class="detail-section"><div class="detail-section-title">Blocked Reason</div>';
          html += '<div class="detail-field full" style="border-left: 3px solid var(--danger)"><div class="detail-field-value" style="color:var(--danger)">' + escapeHtml(task.blocked_reason) + '</div></div></div>';
        }
        if (task.status === 'failed' && task.failure_reason) {
          html += '<div class="detail-section"><div class="detail-section-title">Failure Reason</div>';
          html += '<div class="detail-field full" style="border-left: 3px solid var(--danger)"><div class="detail-field-value" style="color:var(--danger)">' + escapeHtml(task.failure_reason) + '</div></div></div>';
        }
        if (task.status === 'cancelled' && task.cancellation_reason) {
          html += '<div class="detail-section"><div class="detail-section-title">Cancellation Reason</div>';
          html += '<div class="detail-field full" style="border-left: 3px solid var(--muted)"><div class="detail-field-value" style="color:var(--muted)">' + escapeHtml(task.cancellation_reason) + '</div></div></div>';
        }

        html += '<div class="detail-section"><div class="detail-section-title">Linking</div>';
        html += '<label>Initiative</label><select id="edit-task-initiative">';
        html += '<option value="">(None)</option>';
        currentInitiatives.forEach(init => {
          html += '<option value="' + init.id + '"' + (task.initiative === init.id ? ' selected' : '') + '>' + init.id + ': ' + init.title + '</option>';
        });
        html += '</select>';
        html += '<button class="btn-save" style="flex:none;margin-top:0;" id="btn-link-task">Link / Update</button>';
        html += '</div>';

        if (task.description) {
          html += '<div class="detail-section"><div class="detail-section-title">Description</div>';
          html += '<div class="detail-field full"><div class="detail-field-value">' + escapeHtml(task.description) + '</div></div></div>';
        }

        html += renderAcceptanceCriteria(task.acceptance_criteria);

        html += '<div class="detail-section"><div class="detail-section-title">Dates</div><div class="detail-grid">';
        html += field('Created', task.created_at, { date: true });
        html += field('Started', task.started_at, { date: true });
        html += field('Completed', task.completed_at, { date: true });
        html += field('Updated', task.updated_at, { date: true });
        html += field('Due', task.due, { date: true });
        html += '</div></div>';

        sidebarBodyEl.innerHTML = html;

        document.getElementById('btn-link-task').onclick = async () => {
          const initId = document.getElementById('edit-task-initiative').value;
          try {
            await postJson('/api/tasks/' + encodeURIComponent(task.id), { initiative: initId || null }, 'PATCH');
            closeSidebar();
            refresh();
          } catch (err) {
            alert(err.message);
          }
        };
      }

      function renderInitiativeDetail(init) {
        sidebarTitleEl.textContent = init.title || init.id;
        var html = '';

        html += '<div class="detail-section"><div class="detail-section-title">Overview</div><div class="detail-grid">';
        html += field('ID', init.id, { mono: true, full: true });
        html += field('Status', init.status, { badge: statusBadgeClass(init.status) });
        html += field('Objective', init.objective);
        html += field('Timeframe', init.timeframe);
        html += '</div></div>';

        if (init.goal) {
          html += '<div class="detail-section"><div class="detail-section-title">Goal</div>';
          html += '<div class="detail-field full"><div class="detail-field-value">' + init.goal + '</div></div></div>';
        }

        html += '<div class="detail-section"><div class="detail-section-title">Dates</div><div class="detail-grid">';
        html += field('Created', init.created_at, { date: true });
        html += field('Updated', init.updated_at, { date: true });
        html += '</div></div>';

        if (init.tasks && init.tasks.length > 0) {
          html += '<div class="detail-section"><div class="detail-section-title">Tasks (' + init.tasks.length + ')</div>';
          html += '<div class="detail-field full"><div class="detail-field-value mono">' + init.tasks.join('<br>') + '</div></div></div>';
        }

        sidebarBodyEl.innerHTML = html;
      }

      function openSidebar(type, id) {
        var endpoint = type === 'task' ? '/api/tasks/' : '/api/initiatives/';
        fetchJson(endpoint + encodeURIComponent(id)).then(function(data) {
          if (type === 'task') renderTaskDetail(data);
          else renderInitiativeDetail(data);
          sidebarEl.classList.add('open');
          overlayEl.classList.add('open');
        }).catch(function(err) {
          sidebarTitleEl.textContent = 'Error';
          sidebarBodyEl.innerHTML = '<div style="color:var(--danger);padding:12px;">Failed to load: ' + err.message + '</div>';
          sidebarEl.classList.add('open');
          overlayEl.classList.add('open');
        });
      }

      // New Task / Initiative Forms
      function showNewTaskForm() {
        sidebarTitleEl.textContent = 'New Task';
        var html = '<div class="detail-section">';
        html += '<label>Title</label><input type="text" id="new-task-title" placeholder="Summary of work">';
        html += '<label>Description</label><textarea id="new-task-description" rows="3"></textarea>';
        html += '<label>Worker Type</label><select id="new-task-worker">';
        WORKER_TYPES.forEach(t => html += '<option value="' + t + '"' + (t === 'ops' ? ' selected' : '') + '>' + t + '</option>');
        html += '</select>';
        html += '<label>Priority</label><select id="new-task-priority">';
        PRIORITIES.forEach(p => html += '<option value="' + p + '"' + (p === 'P2' ? ' selected' : '') + '>' + p + '</option>');
        html += '</select>';
        html += '<label>Initiative (Optional)</label><select id="new-task-initiative">';
        html += '<option value="">(None)</option>';
        currentInitiatives.forEach(init => html += '<option value="' + init.id + '">' + init.id + ': ' + init.title + '</option>');
        html += '</select>';
        html += '<label>Acceptance Criteria (one per line)</label><textarea id="new-task-criteria" rows="3"></textarea>';
        html += '<div class="form-actions"><button class="btn-save" id="btn-save-task">Create Task</button><button class="btn-cancel" id="btn-cancel-task">Cancel</button></div>';
        html += '</div>';
        sidebarBodyEl.innerHTML = html;
        sidebarEl.classList.add('open');
        overlayEl.classList.add('open');

        document.getElementById('btn-cancel-task').onclick = closeSidebar;
        document.getElementById('btn-save-task').onclick = async () => {
          const payload = {
            title: document.getElementById('new-task-title').value,
            description: document.getElementById('new-task-description').value,
            worker_type: document.getElementById('new-task-worker').value,
            priority: document.getElementById('new-task-priority').value,
            initiative: document.getElementById('new-task-initiative').value || null,
            acceptance_criteria: document.getElementById('new-task-criteria').value.split('\\n').filter(Boolean).map(line => ({ description: line.trim(), done: false }))
          };
          try {
            await postJson('/api/tasks', payload);
            closeSidebar();
            refresh();
          } catch (err) {
            alert(err.message);
          }
        };
      }

      function showNewInitiativeForm() {
        sidebarTitleEl.textContent = 'New Initiative';
        var html = '<div class="detail-section">';
        html += '<label>Title</label><input type="text" id="new-init-title" placeholder="Project Name">';
        html += '<label>Goal</label><textarea id="new-init-goal" rows="2" placeholder="What is the desired outcome?"></textarea>';
        html += '<label>Objective</label><select id="new-init-objective">';
        OBJECTIVES.forEach(o => html += '<option value="' + o + '"' + (o === 'other' ? ' selected' : '') + '>' + o + '</option>');
        html += '</select>';
        html += '<label>Timeframe</label><input type="text" id="new-init-timeframe" placeholder="e.g. Q1 2026">';
        html += '<div class="form-actions"><button class="btn-save" id="btn-save-init">Create Initiative</button><button class="btn-cancel" id="btn-cancel-init">Cancel</button></div>';
        html += '</div>';
        sidebarBodyEl.innerHTML = html;
        sidebarEl.classList.add('open');
        overlayEl.classList.add('open');

        document.getElementById('btn-cancel-init').onclick = closeSidebar;
        document.getElementById('btn-save-init').onclick = async () => {
          const payload = {
            title: document.getElementById('new-init-title').value,
            goal: document.getElementById('new-init-goal').value,
            objective: document.getElementById('new-init-objective').value,
            timeframe: document.getElementById('new-init-timeframe').value
          };
          try {
            await postJson('/api/initiatives', payload);
            closeSidebar();
            refresh();
          } catch (err) {
            alert(err.message);
          }
        };
      }

      document.getElementById('btn-new-task').onclick = showNewTaskForm;
      document.getElementById('btn-new-initiative').onclick = showNewInitiativeForm;

      document.addEventListener('click', function(e) {
        var card = e.target.closest('[data-type][data-id]');
        if (!card) return;
        openSidebar(card.getAttribute('data-type'), card.getAttribute('data-id'));
      });

      refresh().catch(function(err) {
        document.body.insertAdjacentHTML('afterbegin',
          '<div style="background:var(--card);border:1px solid var(--danger);border-radius:8px;padding:12px;margin-bottom:12px;color:var(--danger);">Dashboard load failed: ' + err.message + '</div>'
        );
      });

      setInterval(function() {
        refresh().catch(function() {});
      }, 5000);
    </script>
  </body>
</html>`;
}

const flags = parseArgs(process.argv.slice(2));
const root = resolveRoot(flags['base-dir']);
const host = flags.host || process.env.DASHBOARD_HOST || '127.0.0.1';
const port = Number(flags.port || process.env.DASHBOARD_PORT || 4377);
const missionControlPath = join(root, 'mission-control');

if (!existsSync(missionControlPath) || !statSync(missionControlPath).isDirectory()) {
  process.stderr.write(`dashboard error: mission-control directory not found at ${missionControlPath}\n`);
  process.exit(1);
}

if (flags['dry-run'] === 'true') {
  const tasks = readTasks(root);
  const initiatives = readInitiatives(root);
  const lock = readLock(root);
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        root,
        mission_control: missionControlPath,
        summary: buildSummary(tasks, initiatives, lock),
        samples: {
          tasks: tasks.slice(0, 3).map((task) => ({ id: task.id, status: task.status, priority: task.priority })),
          initiatives: initiatives.slice(0, 3).map((initiative) => ({ id: initiative.id, status: initiative.status })),
          activity_count: readActivity(root, 25).length,
        },
      },
      null,
      2
    ) + '\n'
  );
  process.exit(0);
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
    const { pathname, searchParams } = requestUrl;

    if (pathname === '/health' || pathname === '/api/health') {
      const tasks = readTasks(root);
      const initiatives = readInitiatives(root);
      return json(res, 200, { ok: true, root, mission_control: missionControlPath, tasks: tasks.length, initiatives: initiatives.length });
    }

    if (pathname === '/api/tasks' && req.method === 'GET') {
      let tasks = readTasks(root);
      const status = searchParams.get('status');
      const priority = searchParams.get('priority');
      const initiative = searchParams.get('initiative');
      const query = (searchParams.get('q') || '').trim().toLowerCase();
      if (status) tasks = tasks.filter((task) => task.status === status);
      if (priority) tasks = tasks.filter((task) => task.priority === priority);
      if (initiative) tasks = tasks.filter((task) => task.initiative === initiative);
      if (query) {
        tasks = tasks.filter((task) => task.id.toLowerCase().includes(query) || task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query));
      }
      return json(res, 200, tasks);
    }

    if (pathname === '/api/tasks' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const params = JSON.parse(body);
      if (!params.title || !params.description) return json(res, 400, { message: 'Title and description required' });

      const result = withFileLock('task-create', root, () => {
        const tasks = readTasks(root);
        const now = new Date().toISOString();
        const id = params.initiative ? initiativeTaskId(nextInitiativeTaskSeq(tasks), params.title) : nextStandaloneTaskId(tasks);
        const task = {
          id,
          title: params.title,
          status: 'ready',
          priority: params.priority || 'P2',
          worker_type: params.worker_type || 'ops',
          origin: 'user',
          initiative: params.initiative || null,
          description: params.description,
          acceptance_criteria: params.acceptance_criteria || [],
          outputs: [],
          project: null,
          depends_on: [],
          retry_count: 0,
          revision_count: 0,
          blocked_reason: null,
          failure_reason: null,
          cancellation_reason: null,
          created_at: now,
          started_at: null,
          completed_at: null,
          updated_at: now,
          due: null,
        };
        const dir = join(root, 'mission-control', 'tasks');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${id}.md`), renderNewTaskFile(task));

        if (task.initiative) {
          try {
            const initDir = join(root, 'mission-control', 'initiatives');
            const initPath = join(initDir, `${task.initiative}.md`);
            if (existsSync(initPath)) {
              const init = parseInitiative(initPath);
              if (!init.tasks.includes(id)) {
                init.tasks.push(id);
                init.updated_at = now;
                writeFileSync(initPath, renderInitiativeFrontmatter(init));
              }
            }
          } catch (e) { /* ignore initiative link error */ }
        }

        appendActivityLog({ event: 'task.created', task_id: id, detail: task.title }, root);
        return task;
      });
      return json(res, 201, result);
    }

    if (pathname.startsWith('/api/tasks/') && (req.method === 'PATCH' || req.method === 'PUT')) {
      const id = decodeURIComponent(pathname.slice('/api/tasks/'.length));
      let body = '';
      for await (const chunk of req) body += chunk;
      const patch = JSON.parse(body);

      const result = withFileLock('task-update', root, () => {
        const dir = join(root, 'mission-control', 'tasks');
        const path = join(dir, `${id}.md`);
        if (!existsSync(path)) throw new Error('Task not found');
        const raw = readFileSync(path, 'utf8');
        const { body: contentBody } = parseFrontmatter(raw);
        const task = parseTask(path);
        const oldInitiative = task.initiative;
        
        const now = new Date().toISOString();
        const updated = { ...task, ...patch, updated_at: now };
        
        if (contentBody.trim()) {
          writeFileSync(path, renderLegacyTaskFile(updated, contentBody));
        } else {
          writeFileSync(path, renderNewTaskFile(updated));
        }

        // Handle initiative re-linking
        if (updated.initiative !== oldInitiative) {
          const initDir = join(root, 'mission-control', 'initiatives');
          if (oldInitiative) {
            const oldPath = join(initDir, `${oldInitiative}.md`);
            if (existsSync(oldPath)) {
              const init = parseInitiative(oldPath);
              init.tasks = init.tasks.filter(tid => tid !== id);
              init.updated_at = now;
              writeFileSync(oldPath, renderInitiativeFrontmatter(init));
            }
          }
          if (updated.initiative) {
            const newPath = join(initDir, `${updated.initiative}.md`);
            if (existsSync(newPath)) {
              const init = parseInitiative(newPath);
              if (!init.tasks.includes(id)) {
                init.tasks.push(id);
                init.updated_at = now;
                writeFileSync(newPath, renderInitiativeFrontmatter(init));
              }
            }
          }
        }

        appendActivityLog({ event: 'task.updated', task_id: id, detail: 'Updated via dashboard' }, root);
        return updated;
      });
      return json(res, 200, result);
    }

    if (pathname.startsWith('/api/tasks/')) {
      const id = decodeURIComponent(pathname.slice('/api/tasks/'.length));
      const task = readTasks(root).find((item) => item.id === id);
      if (!task) return json(res, 404, { error: `Task not found: ${id}` });
      return json(res, 200, task);
    }

    if (pathname === '/api/initiatives' && req.method === 'GET') {
      let initiatives = readInitiatives(root);
      const status = searchParams.get('status');
      if (status) initiatives = initiatives.filter((item) => item.status === status);
      return json(res, 200, initiatives);
    }

    if (pathname === '/api/initiatives' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const params = JSON.parse(body);
      if (!params.title || !params.goal) return json(res, 400, { message: 'Title and goal required' });

      const id = initiativeIdFromTitle(params.title);
      const now = new Date().toISOString();
      const initiative = {
        id,
        title: params.title,
        status: 'active',
        objective: params.objective || 'other',
        goal: params.goal,
        timeframe: params.timeframe || '',
        tasks: [],
        created_at: now,
        updated_at: now,
      };
      const dir = join(root, 'mission-control', 'initiatives');
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `${id}.md`);
      if (existsSync(path)) return json(res, 400, { message: 'Initiative already exists' });
      writeFileSync(path, renderInitiativeFrontmatter(initiative));
      appendActivityLog({ event: 'initiative.created', initiative_id: id, detail: initiative.title }, root);
      return json(res, 201, initiative);
    }

    if (pathname.startsWith('/api/initiatives/')) {
      const id = decodeURIComponent(pathname.slice('/api/initiatives/'.length));
      const initiative = readInitiatives(root).find((item) => item.id === id);
      if (!initiative) return json(res, 404, { error: `Initiative not found: ${id}` });
      return json(res, 200, initiative);
    }

    if (pathname === '/api/lock') return json(res, 200, readLock(root));
    if (pathname === '/api/activity') {
      const limit = Number(searchParams.get('limit') || 200);
      return json(res, 200, readActivity(root, limit));
    }
    if (pathname === '/api/summary') {
      const tasks = readTasks(root);
      const initiatives = readInitiatives(root);
      const lock = readLock(root);
      return json(res, 200, buildSummary(tasks, initiatives, lock));
    }

    if (pathname === '/' || pathname === '/dashboard') {
      return text(res, 200, dashboardHtml(root, missionControlPath), 'text/html; charset=utf-8');
    }

    return json(res, 404, { error: 'Not found', path: pathname });
  } catch (error) {
    return json(res, 500, { error: 'internal_error', message: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`NanoClaw dashboard listening on http://${host}:${port}\n`);
  process.stdout.write(`Base dir: ${root}\n`);
  process.stdout.write(`Mission control: ${missionControlPath}\n`);
});
