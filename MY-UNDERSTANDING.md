## Agent Meta Configurability
Agents by design can configure their source code via the agent-runner files. I do not like this philosophy.
I believe the agent framework should give lee-way to the agents to perform tasks as they need, but the agents and the framework should work in a predictable manner.

The following code is what provides that meta-level configuration for agents in their own containers.

```ts
  // Copy agent-runner source into a per-group writable location so agents
  // can customize it (add tools, change behavior) without affecting other
  // groups. Recompiled on container startup via entrypoint.sh.
  const agentRunnerSrc = path.join(
    projectRoot,
    'container',
    'agent-runner',
    'src',
  );
  const groupAgentRunnerDir = path.join(
    DATA_DIR,
    'sessions',
    group.folder,
    'agent-runner-src',
  );
  if (fs.existsSync(agentRunnerSrc)) {
    fs.cpSync(agentRunnerSrc, groupAgentRunnerDir, { recursive: true });
  }
```

## Tasks
Main group sees all tasks, all others only see their own.
The filtered tasks (all for main) are written to the group's ipc directory + current_tasks.json
src/container-runner.ts#writeTasksSnapshot

## Groups and JIDs

JID - a chat-level identifier from the underlying platform, namespaced by platform.
Example: dc:1468824513654423697 identifies a specific Discord chat/channel.

Group - NanoClaw’s registered chat workspace for a single JID.
It is the registration/config record for that chat and points to the group’s unique folder. That folder is the namespace for the chat’s files, session state, memory, IPC, permissions, and runtime artifacts.

Container - the agent runtime process used for a group.
At most one container run is active at a time for a given registered JID/group entry, though multiple different groups can run concurrently.

The mapping is registeredGroups: Record<string, RegisteredGroup>, where the key is the jid and the value is the registered group config for that chat.

In the current implementation, this is a strict one-to-one mapping:
one jid -> one registered group, and one registered group folder -> one jid

### Available vs Registered
Channel - the platform adapter like Discord, Telegram, Slack, or WhatsApp.
It connects to the external platform and observes chats that already exist there.

Chat - the external conversation endpoint on that platform, identified in NanoClaw by a JID.
On Discord, this is basically a text channel within some server or DM  that the bot can see.

Available group - a discovered group chat that NanoClaw knows exists because the channel integration observed it and stored chat metadata for it.
This does not create a NanoClaw workspace folder or activate message processing by itself.

Registered group - a discovered chat that NanoClaw has explicitly activated and attached to a local group folder.
This is the thing stored in `registeredGroups` and in the `registered_groups` DB table.

Who creates what:
- The external platform creates chats first.
- The channel integration discovers those chats during message events or metadata sync and makes them available.
- The setup flow or the main control group registers an available chat when it should become an active NanoClaw workspace.

The easiest mental model is:
- available = known to NanoClaw
- registered = managed by NanoClaw

## Chats vs Sessions
A chat is the conceptual conversation/channel thread with JID being the unique key to identify it.
A session is the runtime internal state for an agent and its ID is the Claude/Codex session ID for a given group/folder.

## Group Queue
The group queue / state are in-memory concepts and do not persist.
Restart recovers fine because things like Messages and Scheduled Tasks and Last Run Timestamps are persisted in the DB.


## Containers

### Visible paths for a group

Inside the container, the group folder name like `homie` or `worker` does not appear in the mount path.
Each group sees the same fixed container paths; only the host-side source path differs.

Main group example: `homie`

- `/workspace/group` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/homie` (rw)
- `/workspace/global` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/global` (rw)
- `/home/node/.claude` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/homie/.claude` (rw)
- `/workspace/ipc` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/ipc/homie` (rw)
- `/app/src` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/homie/agent-runner-src` (rw)
- `/workspace/extra/<name>` -> additional allowlisted host path(s), if configured
- `/workspace/project/` Is a homie-only mount — workers cannot see them. This path points to the base of the NanoClaw repo. It is read-only.

Non-main group example: `worker`

- `/workspace/group` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/worker` (rw)
- `/workspace/global` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/global` (ro)
- `/home/node/.claude` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/worker/.claude` (rw)
- `/workspace/ipc` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/ipc/worker` (rw)
- `/app/src` -> `/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/worker/agent-runner-src` (rw)
- `/workspace/extra/<name>` -> additional allowlisted host path(s), if configured, often ro for non-main groups


Each container receives its own, isolated IPC directory to prevent cross-group privilege escalation e.g. Worker agent writing to Homie's IPC directory and scheduling tasks with privileges it should not have access to.
So they do not each have a pointer to the same shared directory.

### Sessions
New claude sessions are created and isolated between agents. Each carry their history and memory.

```ts
// Per-group Claude sessions directory (isolated from other groups)
// Each group gets their own .claude/ to prevent cross-group session access
const groupSessionsDir = path.join(
  DATA_DIR,
  'sessions',
  group.folder,
  '.claude',
);
```
### Skills
Skills are synced and inserted into each container's environment.

### Mount Validation
All additional mounts, the ones that go under "workspace/extra/" are verified first by checking them against the allowlist present in "config-examples/mount-allowlist.json".
They are also checked against a blocked pattern list and if they match any of those patterns, the mount is rejected.
E.g If realPath is "/Users/vinchenkov/work/secrets-folder" and a blocked pattern is "secret", it also gets rejected because of includes(...).

### Communication back to Host
The containers are spawned by node and explicitly pipe the stdinput, stdoutput, stderr with the host for two-way comms.

### Secrets
Secretes are read from the .env files and are passed as stdin on container spawn so they are never written to disk within the container.

### Life timeline
When all agents are idle, this is considered a normal state.
When a message arrives in a Discord chat:
1. the Discord channel callback stores the message in SQLite
2. the main message loop polls for new messages
3. if there is already an active container for that group, the message gets piped into it
4. if there is no active container, NanoClaw queues a fresh container run for that group

Incoming messages for the main group can start processing immediately.
For non-main groups they require a trigger, typically something like @Homie before NanoClaw spins up a container for that group.

Agent containers are killed after after a certain timeout period.

For non-tasks based containers, containers that were not spawned based off some ipc/task, the timeout is 30 minutes.

## Logs

1. Main host process logs: logs/nanoclaw.log
2. Main host error logs: logs/nanoclaw.error.log
3. Per-container run logs: groups/{group}/logs/container-*.log
4. Mission-control audit log: groups/shared/mission-control/activity.log.ndjson
5. Setup log: logs/setup.log
6. Advanced Claude session/debug artifacts:
    data/sessions/{group}/.claude/debug/
    data/sessions/{group}/.claude/projects/-workspace-group/<session>.jsonl