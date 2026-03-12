/**
 * mc.ts — Mission Control CLI (standalone, zero deps)
 *
 * Usage: node mc.ts [--base-dir <path>] <resource> <command> [flags]
 *
 * Resources: task | initiative | lock
 * JSON on stdout. Non-zero exit on error.
 *
 * When --base-dir is provided, all paths resolve relative to that directory.
 * Otherwise, looks for mission-control/ in cwd, then uses cwd directly.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// ============================================================================
// Types
// ============================================================================

type TaskStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "done"
  | "cancelled"
  | "blocked"
  | "failed"
  | "verified";

type Priority = "P0" | "P1" | "P2" | "P3";
type WorkerType = "coding" | "research" | "writing" | "long" | "ops" | "admin";
type InitiativeStatus = "active" | "paused" | "complete" | "archived";
type Objective = "projectcal" | "robotics" | "ai-writing" | "north-star" | "other";

interface AcceptanceCriterion {
  description: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  worker_type: WorkerType;
  origin: "user" | "autonomous";
  initiative: string | null;
  description: string;
  acceptance_criteria: AcceptanceCriterion[];
  outputs: string[];
  project: string | null;
  depends_on: string[];
  retry_count: number;
  revision_count: number;
  blocked_reason: string | null;
  failure_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  due: string | null;
  // Legacy fields
  tags?: string[];
  blocked_by?: string[];
  accepted_at?: string | null;
  due_at?: string | null;
}

interface Initiative {
  id: string;
  title: string;
  status: InitiativeStatus;
  objective: Objective;
  goal: string;
  timeframe: string;
  tasks: string[];
  created_at: string;
  updated_at: string;
}

interface LockedState {
  locked: true;
  task_id: string;
  owner: string;
  model: string | null;
  subagent_id: string | null;
  acquired_at: string;
  timeout_minutes: number;
  grace_minutes: number;
  wrap_up_sent: boolean;
}

interface UnlockedState {
  locked: false;
}

type LockState = LockedState | UnlockedState;

interface LockPatchParams {
  task_id?: string;
  owner?: string;
  model?: string | null;
  subagent_id?: string | null;
  acquired_at?: string;
  timeout_minutes?: number;
  grace_minutes?: number;
  wrap_up_sent?: boolean;
}

interface LegacyLockState {
  locked: boolean;
  task_id?: string | null;
  owner?: string | null;
  model?: string | null;
  subagent_id?: string | null;
  acquired_at?: string | null;
  timeout_minutes?: number | null;
  grace_minutes?: number | null;
  wrap_up_sent?: boolean;
}

interface ActivityEvent {
  ts: string;
  actor: string;
  event: string;
  task_id?: string;
  initiative_id?: string;
  detail?: string;
}

interface CreateTaskParams {
  title: string;
  description: string;
  worker_type: WorkerType;
  priority: Priority;
  origin?: "user" | "autonomous";
  initiative?: string | null;
  project?: string | null;
  depends_on?: string[];
  acceptance_criteria?: AcceptanceCriterion[];
  due?: string | null;
}

interface UpdateTaskParams {
  status?: TaskStatus;
  priority?: Priority;
  outputs?: string[];
  blocked_reason?: string | null;
  failure_reason?: string | null;
  cancellation_reason?: string | null;
  depends_on?: string[];
  blocked_by?: string[];
  retry_count?: number;
  revision_count?: number;
  started_at?: string | null;
  completed_at?: string | null;
}

interface CreateInitiativeParams {
  title: string;
  goal: string;
  objective: Objective;
  timeframe?: string;
  status?: InitiativeStatus;
  body?: string;
}

type FlagValue = string | string[];
type ParsedFlags = Record<string, FlagValue>;

// ============================================================================
// Status transitions
// ============================================================================

const allowedTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["ready", "cancelled"],
  ready: ["in_progress", "backlog", "cancelled"],
  in_progress: ["done", "blocked", "failed", "cancelled"],
  blocked: ["ready", "cancelled"],
  failed: ["ready"],
  done: ["verified", "in_progress"],
  verified: [],
  cancelled: [],
};

const allowedInitiativeTransitions: Record<InitiativeStatus, InitiativeStatus[]> = {
  active: ["paused", "complete", "archived"],
  paused: ["active", "archived"],
  complete: ["archived"],
  archived: [],
};

// ============================================================================
// Path resolution
// ============================================================================

function resolveWorkspaceRoot(baseDir?: string): string {
  if (baseDir) return baseDir;
  const cwd = process.cwd();
  if (existsSync(join(cwd, "mission-control"))) return cwd;
  return cwd;
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockDirPath(name: string, root: string): string {
  return join(root, "mission-control", ".mc-locks", name);
}

function withFileLock<T>(name: string, root: string, fn: () => T): T {
  const startedAt = Date.now();
  const timeoutMs = 5000;
  const staleMs = 60000;
  const dir = lockDirPath(name, root);
  mkdirSync(join(root, "mission-control", ".mc-locks"), { recursive: true });

  while (true) {
    try {
      mkdirSync(dir, { recursive: false });
      break;
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
      if (code !== "EEXIST") throw error;

      const ownerPath = join(dir, "owner.json");
      if (existsSync(ownerPath)) {
        try {
          const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as { created_at?: number };
          if (typeof owner.created_at === "number" && Date.now() - owner.created_at > staleMs) {
            rmSync(dir, { recursive: true, force: true });
            continue;
          }
        } catch {
          rmSync(dir, { recursive: true, force: true });
          continue;
        }
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for Mission Control lock: ${name}`);
      }

      sleepMs(50);
    }
  }

  writeFileSync(
    join(dir, "owner.json"),
    JSON.stringify({ pid: process.pid, created_at: Date.now() }),
    "utf8"
  );

  try {
    return fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ============================================================================
// YAML frontmatter parsing (no external deps)
// ============================================================================

function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === "" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v.startsWith("[") || v.startsWith("{")) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseFrontmatter(source: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: source };

  const [, fmRaw, body] = match;
  const frontmatter: Record<string, unknown> = {};

  for (const line of fmRaw.split("\n")) {
    if (!line || line.startsWith(" ") || line.startsWith("-")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    frontmatter[key] = parseScalar(line.slice(idx + 1));
  }

  return { frontmatter, body };
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v) || (typeof v === "object" && v !== null)) return JSON.stringify(v);
  return String(v);
}

// ============================================================================
// Task parsing
// ============================================================================

function parseBodySection(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?:\\n## |$)`);
  const match = body.match(regex);
  return match ? match[1].trim() : "";
}

function parseBodyAcceptanceCriteria(section: string): AcceptanceCriterion[] {
  return section
    .split("\n")
    .map((line) => line.match(/^- \[(x| )\] (.+)$/i))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ description: m[2].trim(), done: m[1].toLowerCase() === "x" }));
}

function normalizeAcceptanceCriteria(
  value: string | undefined,
  source: string
): AcceptanceCriterion[] {
  if (!value) return [];

  if (source === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("invalid --acceptance-criteria-json: expected JSON array");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("invalid --acceptance-criteria-json: expected JSON array");
    }

    return parsed.map((item) => {
      if (typeof item === "string") {
        const description = item.trim();
        if (!description) {
          throw new Error("acceptance criteria cannot be empty");
        }
        return { description, done: false };
      }

      if (typeof item === "object" && item !== null) {
        const description =
          "description" in item && typeof item.description === "string"
            ? item.description.trim()
            : "label" in item && typeof item.label === "string"
              ? item.label.trim()
              : "";
        if (!description) {
          throw new Error("acceptance criteria objects require a description");
        }
        const done = "done" in item ? Boolean(item.done) : false;
        return { description, done };
      }

      throw new Error("acceptance criteria entries must be strings or objects");
    });
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((description) => ({ description, done: false }));
}

function validateTaskAuthoring(description: string, acceptanceCriteria: AcceptanceCriterion[]): void {
  if (acceptanceCriteria.length === 0) {
    throw new Error(
      "Task requires at least one structured acceptance_criteria. Use --acceptance-criterion or --acceptance-criteria-json."
    );
  }
}

function parseTaskFile(path: string): Task {
  const raw = readFileSync(path, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);

  const description = frontmatter.description
    ? String(frontmatter.description)
    : parseBodySection(body, "Description");

  let acceptance_criteria: AcceptanceCriterion[];
  if (Array.isArray(frontmatter.acceptance_criteria)) {
    acceptance_criteria = (
      frontmatter.acceptance_criteria as Array<{
        description?: string;
        label?: string;
        done?: boolean;
      }>
    ).map((item) => ({
      description: String(item.description ?? item.label ?? ""),
      done: Boolean(item.done),
    }));
  } else {
    const section = parseBodySection(body, "Acceptance Criteria");
    acceptance_criteria = parseBodyAcceptanceCriteria(section);
  }

  return {
    id: String(frontmatter.id ?? ""),
    title: String(frontmatter.title ?? ""),
    status: (frontmatter.status as TaskStatus) ?? "backlog",
    priority: (frontmatter.priority as Priority) ?? "P2",
    worker_type: (frontmatter.worker_type as WorkerType) ?? "ops",
    origin: (frontmatter.origin as "user" | "autonomous") ?? "user",
    initiative: (frontmatter.initiative as string | null) ?? null,
    description,
    acceptance_criteria,
    outputs: Array.isArray(frontmatter.outputs) ? (frontmatter.outputs as string[]) : [],
    project: (frontmatter.project as string | null) ?? null,
    depends_on: Array.isArray(frontmatter.depends_on) ? (frontmatter.depends_on as string[]) : [],
    retry_count: Number(frontmatter.retry_count ?? 0),
    revision_count: Number(frontmatter.revision_count ?? 0),
    blocked_reason: (frontmatter.blocked_reason as string | null) ?? null,
    failure_reason: (frontmatter.failure_reason as string | null) ?? null,
    cancellation_reason: (frontmatter.cancellation_reason as string | null) ?? null,
    created_at: String(frontmatter.created_at ?? new Date().toISOString()),
    started_at: (frontmatter.started_at as string | null) ?? null,
    completed_at: (frontmatter.completed_at as string | null) ?? null,
    updated_at: String(frontmatter.updated_at ?? new Date().toISOString()),
    due: (frontmatter.due as string | null) ?? (frontmatter.due_at as string | null) ?? null,
    tags: Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : undefined,
    blocked_by: Array.isArray(frontmatter.blocked_by)
      ? (frontmatter.blocked_by as string[])
      : undefined,
    accepted_at: (frontmatter.accepted_at as string | null) ?? undefined,
    due_at: (frontmatter.due_at as string | null) ?? undefined,
  };
}

function renderNewTaskFile(task: Task): string {
  return [
    "---",
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
    "---",
    "",
  ].join("\n");
}

function renderLegacyTaskFile(task: Task, body: string): string {
  const fm = [
    "---",
    `id: ${task.id}`,
    `title: ${JSON.stringify(task.title)}`,
    `status: ${task.status}`,
    `origin: ${task.origin}`,
    `priority: ${task.priority}`,
    `worker_type: ${task.worker_type}`,
    `created_at: ${task.created_at}`,
    `updated_at: ${task.updated_at}`,
    `accepted_at: ${fmtVal(task.accepted_at)}`,
    `started_at: ${fmtVal(task.started_at)}`,
    `completed_at: ${fmtVal(task.completed_at)}`,
    `due_at: ${fmtVal(task.due_at ?? task.due)}`,
    `cancellation_reason: ${fmtVal(task.cancellation_reason)}`,
    `blocked_reason: ${fmtVal(task.blocked_reason)}`,
    `failure_reason: ${fmtVal(task.failure_reason)}`,
    `retry_count: ${task.retry_count}`,
    `revision_count: ${task.revision_count}`,
    `tags: ${JSON.stringify(task.tags ?? [])}`,
    `project: ${task.project != null ? JSON.stringify(task.project) : ""}`,
    `depends_on: ${JSON.stringify(task.depends_on)}`,
    `blocked_by: ${JSON.stringify(task.blocked_by ?? [])}`,
    `outputs: ${JSON.stringify(task.outputs)}`,
    ...(task.initiative ? [`initiative: ${task.initiative}`] : []),
    "---",
    "",
  ].join("\n");
  return `${fm}${body.trim()}\n`;
}

// ============================================================================
// Task ID generation
// ============================================================================

function nextStandaloneTaskId(tasks: Task[]): string {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const maxSeq = tasks
    .filter((t) => t.id.startsWith(`T-${day}-`))
    .map((t) => Number(t.id.slice(-4)))
    .reduce((max, n) => Math.max(max, Number.isFinite(n) ? n : 0), 0);
  return `T-${day}-${String(maxSeq + 1).padStart(4, "0")}`;
}

function nextInitiativeTaskSeq(tasks: Task[]): string {
  const maxSeq = tasks
    .filter((t) => /^I-\d{3}-/.test(t.id))
    .map((t) => Number(t.id.slice(2, 5)))
    .reduce((max, n) => Math.max(max, Number.isFinite(n) ? n : 0), 0);
  return String(maxSeq + 1).padStart(3, "0");
}

function titleToKebabUpper(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initiativeIdFromTitle(title: string): string {
  return `I-${titleToKebabUpper(title)}`;
}

function initiativeTaskId(seq: string, title: string): string {
  return `I-${seq}-${titleToKebabUpper(title)}`;
}

// ============================================================================
// Task CRUD
// ============================================================================

function taskFilePath(id: string, root: string): string {
  return join(root, "mission-control", "tasks", `${id}.md`);
}

function readTasks(root: string): Task[] {
  const dir = join(root, "mission-control", "tasks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      try {
        return parseTaskFile(join(dir, f));
      } catch {
        return null;
      }
    })
    .filter((t): t is Task => t !== null);
}

function readTask(id: string, root: string): Task {
  const p = taskFilePath(id, root);
  if (!existsSync(p)) throw new Error(`Task not found: ${id}`);
  return parseTaskFile(p);
}

function createTask(
  params: CreateTaskParams,
  root: string
): { task: Task; file: string } {
  return withFileLock("task-create", root, () => {
    const tasks = readTasks(root);
    const now = new Date().toISOString();

    const id = params.initiative
      ? initiativeTaskId(nextInitiativeTaskSeq(tasks), params.title)
      : nextStandaloneTaskId(tasks);

    const task: Task = {
      id,
      title: params.title,
      status: "backlog",
      priority: params.priority,
      worker_type: params.worker_type,
      origin: params.origin ?? "autonomous",
      initiative: params.initiative ?? null,
      description: params.description,
      acceptance_criteria: params.acceptance_criteria ?? [],
      outputs: [],
      project: params.project ?? null,
      depends_on: params.depends_on ?? [],
      retry_count: 0,
      revision_count: 0,
      blocked_reason: null,
      failure_reason: null,
      cancellation_reason: null,
      created_at: now,
      started_at: null,
      completed_at: null,
      updated_at: now,
      due: params.due ?? null,
    };

    const dir = join(root, "mission-control", "tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(taskFilePath(id, root), renderNewTaskFile(task), { encoding: "utf8", flag: "wx" });

    // Link task into parent initiative
    if (params.initiative) {
      try {
        const initiative = readInitiative(params.initiative, root);
        if (!initiative.tasks.includes(id)) {
          const raw = readFileSync(initiativeFilePath(initiative.id, root), "utf8");
          const { body } = parseFrontmatter(raw);
          initiative.tasks.push(id);
          initiative.updated_at = now;
          writeInitiativeFile(initiative, body, root);
        }
      } catch {
        // Initiative not found — task is still created
      }
    }

    appendActivityLog(
      { ts: now, actor: "mc", event: "task.created", task_id: id, detail: task.title },
      root
    );

    return { task, file: `tasks/${id}.md` };
  });
}

function applyTaskPatch(task: Task, patch: UpdateTaskParams): Task {
  if (patch.status && patch.status !== task.status) {
    const allowed = allowedTaskTransitions[task.status];
    if (!allowed.includes(patch.status)) {
      throw new Error(`Invalid status transition: ${task.status} → ${patch.status}`);
    }
    if (patch.status === "ready" && task.status === "failed") {
      if (task.retry_count >= 2) throw new Error("retry_count >= 2; needs human review");
    }
    if (patch.status === "cancelled" && !patch.cancellation_reason && !task.cancellation_reason) {
      throw new Error("cancellation_reason is required when cancelling");
    }
  }

  const now = new Date().toISOString();
  const next: Task = { ...task, updated_at: now };

  if (patch.status !== undefined) {
    next.status = patch.status;
    if (["done", "cancelled", "failed", "verified"].includes(patch.status)) {
      next.completed_at = next.completed_at ?? now;
    }
    if (patch.status === "in_progress") {
      next.started_at = next.started_at ?? now;
    }
    if (patch.status === "ready" && task.status === "failed") {
      next.retry_count = task.retry_count + 1;
      next.failure_reason = null;
    }
  }

  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.outputs !== undefined) next.outputs = patch.outputs;
  if (patch.blocked_reason !== undefined) next.blocked_reason = patch.blocked_reason;
  if (patch.failure_reason !== undefined) next.failure_reason = patch.failure_reason;
  if (patch.cancellation_reason !== undefined) next.cancellation_reason = patch.cancellation_reason;
  if (patch.depends_on !== undefined) next.depends_on = patch.depends_on;
  if (patch.blocked_by !== undefined) next.blocked_by = patch.blocked_by;
  if (patch.retry_count !== undefined) next.retry_count = patch.retry_count;
  if (patch.revision_count !== undefined) next.revision_count = patch.revision_count;
  if (patch.started_at !== undefined) next.started_at = patch.started_at;
  if (patch.completed_at !== undefined) next.completed_at = patch.completed_at;

  return next;
}

function updateTask(
  id: string,
  patch: UpdateTaskParams,
  root: string
): Task {
  const filePath = taskFilePath(id, root);
  if (!existsSync(filePath)) throw new Error(`Task not found: ${id}`);

  const raw = readFileSync(filePath, "utf8");
  const { body } = parseFrontmatter(raw);
  const task = parseTaskFile(filePath);
  const updated = applyTaskPatch(task, patch);

  if (body.trim().length > 0) {
    writeFileSync(filePath, renderLegacyTaskFile(updated, body), "utf8");
  } else {
    writeFileSync(filePath, renderNewTaskFile(updated), "utf8");
  }

  if (patch.status && patch.status !== task.status) {
    appendActivityLog(
      {
        ts: updated.updated_at,
        actor: "mc",
        event: "task.status_changed",
        task_id: id,
        detail: `${task.status} → ${updated.status}`,
      },
      root
    );
  }

  if (updated.initiative && patch.status) {
    checkInitiativeCompletion(updated.initiative, root);
  }

  return updated;
}

// ============================================================================
// Initiative parsing and rendering
// ============================================================================

function parseInitiativeFile(path: string): Initiative {
  const raw = readFileSync(path, "utf8");
  const { frontmatter } = parseFrontmatter(raw);
  return {
    id: String(frontmatter.id ?? ""),
    title: String(frontmatter.title ?? ""),
    status: (frontmatter.status as InitiativeStatus) ?? "active",
    objective: (frontmatter.objective as Objective) ?? "other",
    goal: String(frontmatter.goal ?? ""),
    timeframe: String(frontmatter.timeframe ?? ""),
    tasks: Array.isArray(frontmatter.tasks) ? (frontmatter.tasks as string[]) : [],
    created_at: String(frontmatter.created_at ?? new Date().toISOString()),
    updated_at: String(frontmatter.updated_at ?? new Date().toISOString()),
  };
}

function renderInitiativeFrontmatter(initiative: Initiative): string {
  return [
    "---",
    `id: ${initiative.id}`,
    `title: ${JSON.stringify(initiative.title)}`,
    `status: ${initiative.status}`,
    `objective: ${initiative.objective}`,
    `goal: ${JSON.stringify(initiative.goal)}`,
    `timeframe: ${JSON.stringify(initiative.timeframe)}`,
    `tasks: ${JSON.stringify(initiative.tasks)}`,
    `created_at: ${initiative.created_at}`,
    `updated_at: ${initiative.updated_at}`,
    "---",
    "",
  ].join("\n");
}

function initiativeFilePath(id: string, root: string): string {
  return join(root, "mission-control", "initiatives", `${id}.md`);
}

function writeInitiativeFile(initiative: Initiative, body: string, root: string): void {
  const dir = join(root, "mission-control", "initiatives");
  mkdirSync(dir, { recursive: true });
  const content = body.trim()
    ? `${renderInitiativeFrontmatter(initiative)}${body.trim()}\n`
    : renderInitiativeFrontmatter(initiative);
  writeFileSync(initiativeFilePath(initiative.id, root), content, "utf8");
}

// ============================================================================
// Initiative CRUD
// ============================================================================

function readInitiatives(root: string): Initiative[] {
  const dir = join(root, "mission-control", "initiatives");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      try {
        return parseInitiativeFile(join(dir, f));
      } catch {
        return null;
      }
    })
    .filter((i): i is Initiative => i !== null);
}

function readInitiative(id: string, root: string): Initiative {
  const p = initiativeFilePath(id, root);
  if (!existsSync(p)) throw new Error(`Initiative not found: ${id}`);
  return parseInitiativeFile(p);
}

function createInitiative(
  params: CreateInitiativeParams,
  root: string
): { initiative: Initiative; file: string } {
  const id = initiativeIdFromTitle(params.title);
  const now = new Date().toISOString();

  const initiative: Initiative = {
    id,
    title: params.title,
    status: params.status ?? "active",
    objective: params.objective,
    goal: params.goal,
    timeframe: params.timeframe ?? "",
    tasks: [],
    created_at: now,
    updated_at: now,
  };

  writeInitiativeFile(initiative, params.body ?? "", root);
  appendActivityLog(
    { ts: now, actor: "mc", event: "initiative.created", initiative_id: id, detail: initiative.title },
    root
  );

  return { initiative, file: `initiatives/${id}.md` };
}

function updateInitiativeStatus(
  id: string,
  status: InitiativeStatus,
  root: string
): Initiative {
  const initiative = readInitiative(id, root);
  const allowed = allowedInitiativeTransitions[initiative.status];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid initiative transition: ${initiative.status} → ${status}`);
  }

  const raw = readFileSync(initiativeFilePath(id, root), "utf8");
  const { body } = parseFrontmatter(raw);
  const updated = { ...initiative, status, updated_at: new Date().toISOString() };
  writeInitiativeFile(updated, body, root);

  appendActivityLog(
    {
      ts: updated.updated_at,
      actor: "mc",
      event: "initiative.status_changed",
      initiative_id: id,
      detail: `${initiative.status} → ${status}`,
    },
    root
  );

  return updated;
}

function checkInitiativeCompletion(initiativeId: string, root: string): void {
  try {
    const initiative = readInitiative(initiativeId, root);
    if (initiative.status !== "active" || initiative.tasks.length === 0) return;
    const tasks = readTasks(root);
    const linked = tasks.filter((t) => t.initiative === initiativeId);
    const allTerminal =
      linked.length > 0 &&
      linked.every((t) => ["done", "verified", "cancelled"].includes(t.status));
    if (allTerminal) {
      updateInitiativeStatus(initiativeId, "complete", root);
      appendActivityLog(
        {
          ts: new Date().toISOString(),
          actor: "mc",
          event: "initiative.completed",
          initiative_id: initiativeId,
          detail: `All tasks terminal for ${initiativeId}`,
        },
        root
      );
    }
  } catch {
    // Ignore
  }
}

// ============================================================================
// Activity log
// ============================================================================

function appendActivityLog(event: ActivityEvent, root: string): void {
  const logPath = join(root, "mission-control", "activity.log.ndjson");
  appendFileSync(logPath, JSON.stringify(event) + "\n", "utf8");
}

// ============================================================================
// Lock operations
// ============================================================================

function parseBooleanFlag(value: string | undefined, flagName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  fail(`${flagName} must be true or false`);
}

function parseNumberFlag(value: string | undefined, flagName: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`${flagName} must be a non-negative number`);
  }
  return parsed;
}

function normalizeLockState(lock: LegacyLockState): LockState {
  if (!lock || lock.locked !== true) {
    return { locked: false };
  }

  const taskId = typeof lock.task_id === "string" && lock.task_id.trim().length > 0
    ? lock.task_id.trim()
    : null;
  const owner = typeof lock.owner === "string" && lock.owner.trim().length > 0
    ? lock.owner.trim()
    : null;
  const acquiredAt = typeof lock.acquired_at === "string" && lock.acquired_at.trim().length > 0
    ? lock.acquired_at.trim()
    : null;
  const timeoutMinutes =
    typeof lock.timeout_minutes === "number" && Number.isFinite(lock.timeout_minutes)
      ? lock.timeout_minutes
      : 60;
  const graceMinutes =
    typeof lock.grace_minutes === "number" && Number.isFinite(lock.grace_minutes)
      ? lock.grace_minutes
      : 15;

  if (!taskId || !owner || !acquiredAt) {
    throw new Error("lock.json is invalid: locked state requires task_id, owner, and acquired_at");
  }

  return {
    locked: true,
    task_id: taskId,
    owner,
    model: typeof lock.model === "string" ? lock.model : null,
    subagent_id: typeof lock.subagent_id === "string" ? lock.subagent_id : null,
    acquired_at: acquiredAt,
    timeout_minutes: timeoutMinutes,
    grace_minutes: graceMinutes,
    wrap_up_sent: lock.wrap_up_sent === true,
  };
}

function readLock(root: string): LockState {
  const p = join(root, "mission-control", "lock.json");
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as LegacyLockState;
    return normalizeLockState(parsed);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { locked: false };
    }
    throw error;
  }
}

function ensureMissionControlDir(root: string): void {
  mkdirSync(join(root, "mission-control"), { recursive: true });
}

function writeLock(lock: LockState, root: string): void {
  ensureMissionControlDir(root);
  writeFileSync(join(root, "mission-control", "lock.json"), JSON.stringify(lock, null, 2), "utf8");
}

function acquireLock(
  params: {
    taskId: string;
    workerType: WorkerType;
    model?: string | null;
    subagentId?: string | null;
    timeoutMinutes?: number;
    graceMinutes?: number;
  },
  root: string
): LockedState {
  const current = readLock(root);
  if (current.locked) {
    throw new Error(`Lock already held by ${current.owner} for task ${current.task_id}`);
  }

  const lock: LockedState = {
    locked: true,
    task_id: params.taskId,
    owner: `worker:${params.workerType}`,
    model: params.model ?? null,
    subagent_id: params.subagentId ?? null,
    acquired_at: new Date().toISOString(),
    timeout_minutes: params.timeoutMinutes ?? 60,
    grace_minutes: params.graceMinutes ?? 15,
    wrap_up_sent: false,
  };
  writeLock(lock, root);
  return lock;
}

function patchLock(patch: LockPatchParams, root: string): LockedState {
  const current = readLock(root);
  if (!current.locked) {
    throw new Error("Cannot update lock: lock is not currently held");
  }

  const next: LockedState = {
    ...current,
    ...(patch.task_id !== undefined ? { task_id: patch.task_id } : {}),
    ...(patch.owner !== undefined ? { owner: patch.owner } : {}),
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.subagent_id !== undefined ? { subagent_id: patch.subagent_id } : {}),
    ...(patch.acquired_at !== undefined ? { acquired_at: patch.acquired_at } : {}),
    ...(patch.timeout_minutes !== undefined ? { timeout_minutes: patch.timeout_minutes } : {}),
    ...(patch.grace_minutes !== undefined ? { grace_minutes: patch.grace_minutes } : {}),
    ...(patch.wrap_up_sent !== undefined ? { wrap_up_sent: patch.wrap_up_sent } : {}),
  };

  writeLock(next, root);
  return next;
}

// ============================================================================
// Arg parsing
// ============================================================================

function parseFlags(args: string[]): { positional: string[]; flags: ParsedFlags } {
  const flags: ParsedFlags = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      const value = next && !next.startsWith("--") ? next : "true";
      if (next && !next.startsWith("--")) {
        i++;
      }

      const current = flags[key];
      if (current === undefined) {
        flags[key] = value;
      } else if (Array.isArray(current)) {
        current.push(value);
      } else {
        flags[key] = [current, value];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function getFlag(flags: ParsedFlags, key: string): string | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[value.length - 1] : value;
}

function getFlagList(flags: ParsedFlags, key: string): string[] {
  const value = flags[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function out(data: unknown): never {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function fail(message: string): never {
  process.stderr.write(`mc error: ${message}\n`);
  process.exit(1);
}

// ============================================================================
// Entry
// ============================================================================

const allArgs = process.argv.slice(2);

// Extract --base-dir before resource/command parsing
let baseDir: string | undefined;
const filteredArgs: string[] = [];
for (let i = 0; i < allArgs.length; i++) {
  if (allArgs[i] === "--base-dir" && allArgs[i + 1]) {
    baseDir = allArgs[i + 1];
    i++;
  } else {
    filteredArgs.push(allArgs[i]);
  }
}

const ROOT = resolveWorkspaceRoot(baseDir);

const [resource, command, ...rest] = filteredArgs;
const { positional, flags } = parseFlags(rest);

if (!resource) fail("Usage: mc <resource> <command> [flags]\nResources: task, initiative, lock");

// ============================================================================
// task
// ============================================================================

if (resource === "task") {
  if (!command) fail("Usage: mc task <create|get|list|update>");

  if (command === "create") {
    const title = getFlag(flags, "title");
    const description = getFlag(flags, "description");
    if (!title) fail("--title is required");
    if (!description) fail("--description is required");

    const workerType = (getFlag(flags, "worker-type") ?? "ops") as WorkerType;
    if (!["coding", "research", "writing", "long", "ops", "admin"].includes(workerType)) {
      fail(`invalid --worker-type: ${workerType}`);
    }

    const priority = (getFlag(flags, "priority") ?? "P2") as Priority;
    if (!["P0", "P1", "P2", "P3"].includes(priority)) {
      fail(`invalid --priority: ${priority}`);
    }

    const criteriaFlags = getFlagList(flags, "acceptance-criterion");
    const criteriaJson = getFlag(flags, "acceptance-criteria-json");
    if (criteriaFlags.length > 0 && criteriaJson !== undefined) {
      fail("use either --acceptance-criterion or --acceptance-criteria-json, not both");
    }

    let acceptanceCriteria: AcceptanceCriterion[] = [];
    try {
      acceptanceCriteria =
        criteriaJson !== undefined
          ? normalizeAcceptanceCriteria(criteriaJson, "json")
          : normalizeAcceptanceCriteria(criteriaFlags.join("\n"), "lines");
      validateTaskAuthoring(description, acceptanceCriteria);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }

    try {
      const result = createTask(
        {
          title,
          description,
          worker_type: workerType,
          priority,
          origin: ((getFlag(flags, "origin") ?? "autonomous") as "user" | "autonomous"),
          initiative: getFlag(flags, "initiative") ?? null,
          project: getFlag(flags, "project") ?? null,
          depends_on: getFlag(flags, "depends-on")
            ? (getFlag(flags, "depends-on") as string).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          acceptance_criteria: acceptanceCriteria,
          due: getFlag(flags, "due") ?? null,
        },
        ROOT
      );
      out({ id: result.task.id, file: result.file });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "get") {
    const id = positional[0] ?? getFlag(flags, "id");
    if (!id) fail("task ID required (positional or --id)");
    try {
      out(readTask(id, ROOT));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "list") {
    let tasks = readTasks(ROOT);
    const initiative = getFlag(flags, "initiative");
    const status = getFlag(flags, "status");
    if (initiative) tasks = tasks.filter((t) => t.initiative === initiative);
    if (status) tasks = tasks.filter((t) => t.status === status);
    out(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        worker_type: t.worker_type,
        initiative: t.initiative,
      }))
    );
  }

  if (command === "update") {
    const id = positional[0] ?? getFlag(flags, "id");
    if (!id) fail("task ID required (positional or --id)");

    const patch: UpdateTaskParams = {};
    if (getFlag(flags, "status")) patch.status = getFlag(flags, "status") as TaskStatus;
    if (getFlag(flags, "priority")) patch.priority = getFlag(flags, "priority") as Priority;
    if (getFlag(flags, "outputs") !== undefined)
      patch.outputs = (getFlag(flags, "outputs") as string).split(",").map((s) => s.trim()).filter(Boolean);
    if (getFlag(flags, "blocked-reason") !== undefined)
      patch.blocked_reason = getFlag(flags, "blocked-reason") || null;
    if (getFlag(flags, "failure-reason") !== undefined)
      patch.failure_reason = getFlag(flags, "failure-reason") || null;
    if (getFlag(flags, "cancellation-reason") !== undefined)
      patch.cancellation_reason = getFlag(flags, "cancellation-reason") || null;
    if (getFlag(flags, "depends-on") !== undefined)
      patch.depends_on = (getFlag(flags, "depends-on") as string).split(",").map((s) => s.trim()).filter(Boolean);
    if (getFlag(flags, "blocked-by") !== undefined)
      patch.blocked_by = (getFlag(flags, "blocked-by") as string).split(",").map((s) => s.trim()).filter(Boolean);
    if (getFlag(flags, "revision-count") !== undefined)
      patch.revision_count = parseNumberFlag(getFlag(flags, "revision-count"), "--revision-count");

    // Enforce output path convention
    if (patch.outputs && patch.status === "done") {
      const invalid = patch.outputs.filter(
        (p) => !p.startsWith("mission-control/outputs/") && !p.startsWith("task/")
      );
      if (invalid.length > 0) {
        fail(
          `Output path(s) must be under mission-control/outputs/ or be a git branch (task/...):\n  ${invalid.join("\n  ")}`
        );
      }
    }

    try {
      const updated = updateTask(id, patch, ROOT);
      out({ ok: true, id: updated.id, status: updated.status });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (!["create", "get", "list", "update"].includes(command)) {
    fail(`Unknown task command: ${command}. Use: create, get, list, update`);
  }
}

// ============================================================================
// initiative
// ============================================================================

else if (resource === "initiative") {
  if (!command) fail("Usage: mc initiative <create|get|list|update>");

  if (command === "create") {
    const title = getFlag(flags, "title");
    const goal = getFlag(flags, "goal");
    const objective = getFlag(flags, "objective") as Objective | undefined;
    if (!title) fail("--title is required");
    if (!goal) fail("--goal is required");
    if (!objective) fail("--objective is required");
    if (!["projectcal", "robotics", "ai-writing", "north-star", "other"].includes(objective)) {
      fail(`invalid --objective: ${objective}`);
    }

    try {
      const result = createInitiative(
        {
          title,
          goal,
          objective,
          timeframe: getFlag(flags, "timeframe") ?? "",
          status: (getFlag(flags, "status") ?? "active") as InitiativeStatus,
        },
        ROOT
      );
      out({ id: result.initiative.id, file: result.file });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "get") {
    const id = positional[0] ?? getFlag(flags, "id");
    if (!id) fail("initiative ID required (positional or --id)");
    try {
      out(readInitiative(id, ROOT));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "list") {
    let initiatives = readInitiatives(ROOT);
    const status = getFlag(flags, "status");
    if (status) initiatives = initiatives.filter((i) => i.status === status);
    out(
      initiatives.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        objective: i.objective,
        goal: i.goal,
        task_count: i.tasks.length,
      }))
    );
  }

  if (command === "update") {
    const id = positional[0] ?? getFlag(flags, "id");
    if (!id) fail("initiative ID required (positional or --id)");
    const status = getFlag(flags, "status");
    if (!status) fail("--status is required");

    try {
      const updated = updateInitiativeStatus(id, status as InitiativeStatus, ROOT);
      out({ ok: true, id: updated.id, status: updated.status });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (!["create", "get", "list", "update"].includes(command)) {
    fail(`Unknown initiative command: ${command}. Use: create, get, list, update`);
  }
}

// ============================================================================
// lock
// ============================================================================

else if (resource === "lock") {
  if (!command) fail("Usage: mc lock <acquire|release|status|update>");

  if (command === "status") {
    try {
      out(readLock(ROOT));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "acquire") {
    const taskId = getFlag(flags, "task-id");
    const workerType = getFlag(flags, "worker-type") as WorkerType | undefined;
    if (!taskId) fail("--task-id is required");
    if (!workerType) fail("--worker-type is required");
    if (!["coding", "research", "writing", "long", "ops", "admin"].includes(workerType)) {
      fail(`invalid --worker-type: ${workerType}`);
    }

    try {
      const lock = acquireLock(
        {
          taskId,
          workerType,
          model: getFlag(flags, "model") ?? null,
          subagentId: getFlag(flags, "subagent-id") ?? null,
          timeoutMinutes: parseNumberFlag(getFlag(flags, "timeout-minutes"), "--timeout-minutes"),
          graceMinutes: parseNumberFlag(getFlag(flags, "grace-minutes"), "--grace-minutes"),
        },
        ROOT
      );
      out(lock);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "release") {
    try {
      const current = readLock(ROOT);
      writeLock({ locked: false }, ROOT);
      out({
        ok: true,
        locked: false,
        previous_task_id: current.locked ? current.task_id : null,
        previous_owner: current.locked ? current.owner : null,
      });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (command === "update") {
    const patch: LockPatchParams = {};
    if (getFlag(flags, "task-id") !== undefined) patch.task_id = getFlag(flags, "task-id");
    if (getFlag(flags, "owner") !== undefined) patch.owner = getFlag(flags, "owner");
    if (getFlag(flags, "model") !== undefined) patch.model = getFlag(flags, "model") || null;
    if (getFlag(flags, "subagent-id") !== undefined) patch.subagent_id = getFlag(flags, "subagent-id") || null;
    if (getFlag(flags, "acquired-at") !== undefined) patch.acquired_at = getFlag(flags, "acquired-at");
    if (getFlag(flags, "timeout-minutes") !== undefined) {
      patch.timeout_minutes = parseNumberFlag(getFlag(flags, "timeout-minutes"), "--timeout-minutes");
    }
    if (getFlag(flags, "grace-minutes") !== undefined) {
      patch.grace_minutes = parseNumberFlag(getFlag(flags, "grace-minutes"), "--grace-minutes");
    }
    if (getFlag(flags, "wrap-up-sent") !== undefined) {
      patch.wrap_up_sent = parseBooleanFlag(getFlag(flags, "wrap-up-sent"), "--wrap-up-sent");
    }
    if (Object.keys(patch).length === 0) {
      fail("At least one lock field must be provided to update");
    }

    try {
      out(patchLock(patch, ROOT));
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  if (!["acquire", "release", "status", "update"].includes(command)) {
    fail(`Unknown lock command: ${command}. Use: acquire, release, status, update`);
  }
}

// ============================================================================
// Unknown resource
// ============================================================================

else {
  fail(`Unknown resource: ${resource}. Use: task, initiative, lock`);
}
