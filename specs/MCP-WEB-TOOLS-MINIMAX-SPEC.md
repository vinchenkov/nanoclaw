# MiniMax-Compatible Web Research via Brave + Firecrawl MCP

## Overview

Replace Anthropic server-side web tools (`WebSearch`, `WebFetch`) with client-side MCP tools so web research works reliably while keeping MiniMax as the model provider.

This spec covers:

1. Removing unsupported server tools from agent configuration
2. Adding Brave Search MCP + Firecrawl MCP as first-class tool providers
3. Installing MCP server binaries in the container image for runtime reliability
4. Updating worker and planner policy to fail safely when research tooling is unavailable
5. Keeping `agent-browser` available, but restricting its use to explicitly interactive tasks

## Scope

In scope:

- Agent runner tool configuration
- Agent runner MCP server configuration
- Container image dependencies for MCP servers
- Secret pass-through for Brave/Firecrawl API keys
- Worker policy changes for research fallback behavior
- Validation and rollout checklist

Out of scope:

- Re-baselining current behavior (already completed)
- Creating citation enforcement rules (explicitly not required)
- Replacing MiniMax as model provider

## Target State

- Worker agents do web research using MCP tools, not `WebSearch`/`WebFetch`
- Brave handles discovery/search workflows
- Firecrawl handles fetch
- MCP servers are available in-container without runtime package install churn
- If research tools fail after bounded retries, worker marks task `blocked` instead of shipping unverified knowledge-only output
- Browser tool remains installed but used only when task explicitly requires interactive browsing

## Design

### 1) Tool Capability Mapping

- Remove provider-side tools from `allowedTools`:
  - `WebSearch`
  - `WebFetch`
- Keep local tools:
  - `Bash`, `Read`, `Write`, `Edit`, etc.
- Keep existing MCP tool namespace:
  - `mcp__nanoclaw__*`
- Add MCP tool namespaces:
  - `mcp__brave__*`
  - `mcp__firecrawl__*`

Rationale: provider-side web tools are unreliable/incompatible on MiniMax; MCP tools execute client-side and are provider-agnostic.

### 2) MCP Server Registration in Agent SDK

Extend SDK `mcpServers` configuration to include:

- `brave`: Brave MCP server command + args + env
- `firecrawl`: Firecrawl MCP server command + args + env
- keep existing `nanoclaw` MCP server

Notes:

- Server names should be stable and explicit (`brave`, `firecrawl`) because they shape tool names exposed to the model (`mcp__brave__...`, `mcp__firecrawl__...`).
- Configure MCP server env from container input secrets, not hardcoded values.

### 3) Reliability Strategy: Install MCP Binaries in Container Image

Use image-time install (preferred) instead of runtime `npx` fetching.

Requirements:

- Install Brave MCP server binaries/scripts in `container/Dockerfile`
- Install Firecrawl MCP server binaries/scripts in `container/Dockerfile`
- Pin versions (or pin commit/tag) for reproducibility
- Ensure executables are on `PATH` used by agent runner process

Benefits:

- No npm/network dependency during each task run
- Faster tool startup
- Less flaky production behavior

### 4) Secrets and Environment

API keys already exist in local `.env`.

Required changes:

- Extend secret allowlist passed to container/SDK to include:
  - `BRAVE_API_KEY`
  - `FIRECRAWL_API_KEY`

Constraints:

- Continue passing secrets via stdin payload (current secure flow)
- Do not log secret values
- Only expose to SDK/MCP runtime, not general shell process env unless needed for MCP process launch

### 5) Worker Policy Updates

Update worker instructions to make research flow explicit:

1. Prefer MCP tools for research (`mcp__brave__*`, `mcp__firecrawl__*`)
2. Browser usage policy:
   - browser tool remains available
   - browser may be used only for explicitly requested interactive tasks (login, JS interaction, screenshots, form workflows)
   - browser must not be used as generic fallback for research
3. Failure policy:
   - retry threshold: 3 attempts per research objective/tool path
   - if still failing, mark task `blocked` with explicit reason
   - do not silently complete research tasks with unverified, potentially stale parametric output
4. Citation policy:
   - no minimum citation requirement is enforced by policy

## Implementation Plan

### Phase 1: Agent Runner Tool and MCP Wiring

1. Remove `WebSearch` and `WebFetch` from `allowedTools`
2. Add `mcp__brave__*` and `mcp__firecrawl__*` to `allowedTools`
3. Add `brave` and `firecrawl` entries in `mcpServers`
4. Keep existing `nanoclaw` MCP server unchanged

### Phase 2: Secrets Pipeline

1. Extend secret allowlist in host container runner for:
   - `BRAVE_API_KEY`
   - `FIRECRAWL_API_KEY`
2. Verify keys are propagated into SDK env for MCP server processes
3. Validate no secret leakage in logs

### Phase 3: Container Image Reliability

1. Update `container/Dockerfile` to install Brave MCP server (pinned)
2. Update `container/Dockerfile` to install Firecrawl MCP server (pinned)
3. Rebuild container image
4. Verify binaries are resolvable and launch cleanly at runtime

### Phase 4: Contract Hardening

1. Update worker AND planner`CLAUDE.md` research section to prefer MCP web tools
2. Add explicit browser restriction language (interactive-only)
3. Add explicit retry behavior: max 3 attempts
4. Add explicit block-on-failure behavior for research tasks
5. Keep no citation minimum requirement

### Phase 5: Verification

Run an end-to-end research task and verify:

1. Trace shows `mcp__brave__*` and/or `mcp__firecrawl__*` tool calls
2. Trace does not show `WebSearch`/`WebFetch` usage
3. On simulated MCP failure, worker marks task `blocked` after 3 retries
4. Browser is not used unless task explicitly requires interaction
5. Task output quality is based on fetched evidence when tools succeed

## Affected Files

Primary expected changes:

- `container/agent-runner/src/index.ts`
  - `allowedTools` updates
  - `mcpServers` updates
- `src/container-runner.ts`
  - secret allowlist additions for Brave/Firecrawl keys
- `container/Dockerfile`
  - install/pin Brave and Firecrawl MCP server binaries
- `groups/worker/CLAUDE.md`
  - research policy update (MCP preference, browser restriction, retry=3, blocked fallback)
- `groups/homie/CLAUDE.md`
  - research policy update (MCP preference, browser restriction, retry=3, blocked fallback)

Optional/supporting changes (if needed):

- tests for runner config and secrets flow
- docs note in root `CLAUDE.md` or ops docs describing MCP web stack

## Acceptance Criteria

1. Worker/Planner research succeeds on MiniMax using Brave + Firecrawl MCP tools
2. `WebSearch`/`WebFetch` are no longer called by worker sessions
3. MCP servers start reliably without runtime package fetch dependency
4. API keys are sourced from `.env` through existing secret flow
5. Worker enforces retry threshold of 3 and blocks on persistent research failure
6. Browser remains available only for explicitly interactive tasks

## Risks and Mitigations

1. MCP server startup failures
- Mitigation: pin versions, image-time install, startup smoke checks

2. Tool-name mismatch after MCP integration
- Mitigation: inspect exposed tool names in trace; align policy text with actual prefixes


