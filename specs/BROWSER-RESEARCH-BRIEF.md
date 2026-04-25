# Browser Research Brief — Real Human-Observable Browser Interaction for NanoClaw

## Purpose

This document is a research brief for a fresh agent to investigate how to integrate real, human-observable browser interaction into NanoClaw's agent pipeline. The researcher should search the web and relevant repos to evaluate options and return a prioritized recommendation.

---

## Current Stack — Exact Versions

### NanoClaw host
| Component | Value |
|-----------|-------|
| NanoClaw version | 1.2.6 |
| Node.js (host) | >=20 (required), host is macOS Darwin 25.4.0 |
| Channel | Discord (bot: Homie#5609) |
| `@anthropic-ai/claude-code` (global, host) | 2.1.118 |
| `@openai/codex` (global, host) | 0.123.0 |

### Agent container (Docker, `nanoclaw-agent:latest`, `node:22-slim` base)
| Component | Value |
|-----------|-------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.34 |
| `@openai/codex-sdk` | ^0.113.0 |
| `@modelcontextprotocol/sdk` | ^1.12.1 |
| `@anthropic-ai/claude-code` (container global) | latest at image build time (same as host: 2.1.118) |
| `@openai/codex` (container global) | latest at image build time (0.123.0) |
| `agent-browser` (container global) | installed globally via `npm install -g agent-browser` — no pinned version |
| `@modelcontextprotocol/server-brave-search` | 0.6.2 |
| `firecrawl-mcp` | 3.10.3 |
| Chromium (system) | installed via `apt-get install -y chromium` — no pinned version |

### Model / API
| Variable | Value |
|----------|-------|
| `AGENT_SDK` | `claude` (in `.env` — note: user believes it may be `codex`, but `.env` shows `claude`) |
| `ANTHROPIC_BASE_URL` | `https://api.minimax.io/anthropic` (MiniMax, not Anthropic) |
| `CLAUDE_MODEL` | `MiniMax-M2.7` |
| `EVALUATE_MODE` | `true` |

---

## Current Browser Capability — What Exists Today

### `agent-browser` CLI (Playwright-based)

Installed globally in the container as `agent-browser`. Exposes a CLI that the agent calls via Bash. It is a thin wrapper around Playwright. The skill descriptor is at `container/skills/agent-browser/SKILL.md`.

**What it can do today:**
- Navigate to URLs (`agent-browser open <url>`)
- Take accessibility snapshots with element refs (`agent-browser snapshot -i`)
- Click, fill, type, press, hover, check, select, scroll, upload via refs
- Extract text/html/attributes/title/url/count
- Save screenshots to container filesystem (`agent-browser screenshot path.png`)
- Save PDFs
- Wait for elements, text, URL patterns, network idle
- Semantic locators (role, text, label, placeholder)
- Save/load browser state (cookies, localStorage)
- Run arbitrary JavaScript via `agent-browser eval`
- Manage cookies and localStorage

**Critical limitations:**
- **Headless only** — the container is a Linux VM with no X11/Wayland display server. The browser is invisible.
- **Screenshots are files in the container filesystem** — there is no mechanism to pipe them back to the user via Discord. The `Channel.sendMessage(jid, text)` interface (defined in `src/types.ts`) is **text-only**; there is no `sendFile` or `sendImage` method.
- **No real-time visibility** — the user cannot see what the browser is doing while the agent runs. There is no VNC, no stream, no live feedback.
- **Policy-restricted** — all group AGENTS.md files (homie, worker, verifier) explicitly restrict `agent-browser` to tasks that *explicitly require* interactive browsing; it must not be used as a research fallback.
- **No pinned version** — `agent-browser` is installed without version pinning, which creates reproducibility risk.

### Brave Search MCP (`mcp__brave__*`)
- Installed as `@modelcontextprotocol/server-brave-search@0.6.2`
- BRAVE_API_KEY is passed as a container secret
- Used for keyword search / discovery — returns links and summaries, not rendered pages
- Does **not** interact with web apps, does not click, does not screenshot

### Firecrawl MCP (`mcp__firecrawl__*`)
- Installed as `firecrawl-mcp@3.10.3`
- FIRECRAWL_API_KEY is passed as a container secret
- Fetches and extracts structured content from URLs (markdown, HTML)
- Server-side rendering — handles JS-heavy pages
- Does **not** interact (no click, fill, submit, login flows)

---

## What Is Missing — The Gap

The user wants **real browser interaction as a human would see and operate it**. This implies one or more of the following:
1. **Screenshots streamed to Discord** — the agent takes a screenshot and the user receives it as a Discord image attachment (requires extending `Channel.sendMessage` or adding a separate `sendFile` IPC message type)
2. **Live browser window the user can observe** — requires a VNC/noVNC server or remote desktop inside the container, or a hosted browser service
3. **Visual confirmation loop** — the agent can show the user a screenshot, pause, and accept human input before proceeding
4. **Non-headless (headed) browser** — a visible browser window, potentially streamed via screen capture

**What specifically needs research:**

### A. Screenshot delivery to Discord
- What would it take to extend the NanoClaw IPC `send_message` tool to accept image payloads (base64 or file path)?
- Can Discord.js `channel.send({ files: [attachment] })` be added behind a new IPC message type (`send_file`)?
- What is the best format — base64-encoded PNG in the IPC JSON vs. a file path on a shared mount?

### B. Playwright MCP server (alternative to `agent-browser` CLI)
- `@modelcontextprotocol/server-playwright` — does an official Playwright MCP server exist? Is it maintained? What tools does it expose?
- Does the Playwright MCP server work inside a headless Linux container?
- Does it support screenshot responses (returning image data to the model via MCP)?
- How does it compare to the current `agent-browser` CLI approach for Codex SDK vs Claude SDK?
- Is it compatible with MiniMax as the model provider (via Anthropic-compatible API)?

### C. Hosted / cloud browser services
- **Browserbase** — cloud browser sessions with streaming, screenshots, Playwright control. Pricing, API, MCP integration.
- **Steel.dev** — browser-as-a-service for AI agents. MCP server availability, pricing.
- **Anchorbrowser** — similar space.
- **Bright Data Scraping Browser** — Playwright-compatible, cloud-based. MCP availability.
- Are there MCP servers for any of these that could be dropped into the NanoClaw MCP server config the same way Brave/Firecrawl were?

### D. `browser-use` Python library
- What is `browser-use`? Is it relevant here (Node.js stack, not Python)?
- Does it have a Node.js port or MCP interface?

### E. VNC / noVNC inside the container
- What would it take to add Xvfb + noVNC to the container so the user could open a browser tab and watch the agent's browser?
- What is the container startup overhead?
- Is this feasible given containers run and die per-agent-session?

### F. Codex SDK browser support
- Does `@openai/codex-sdk` ^0.113.0 have any native computer-use / browser tool built in?
- The Codex config has `sandbox_mode: 'danger-full-access'` — does this enable any visual/browser features?
- Does OpenAI Codex SDK expose screenshot tools or computer-use natively?

### G. Claude Agent SDK computer use
- Does `@anthropic-ai/claude-agent-sdk` ^0.2.34 have native computer-use tool support (screenshot, cursor, etc.)?
- If so, does it work with MiniMax-M2.7 via the Anthropic-compatible API?

---

## Architecture Context for the Researcher

### How agent tools reach the user (Discord)

```
Agent (container) → agent-browser screenshot /tmp/out.png  [file sits on container FS]
Agent (container) → mcp__nanoclaw__send_message { text: "..." }  [IPC JSON file]
Host (ipc.ts)     → reads IPC → router.ts → Channel.sendMessage(jid, text)  [text only]
Discord bot       → channel.send({ content: text })  [no file attachment today]
```

To stream screenshots to the user, the chain needs to become:
```
Agent → save screenshot → encode/reference → IPC send_file message → host reads → Discord sends attachment
```

### Container isolation
- The container runs as a non-root Linux user inside a Docker (or Apple Container) VM on macOS
- No display server in the container by default
- The container is ephemeral — started per agent session, torn down on completion
- Mounts: group folder, IPC dir, sessions dir — no host display socket mounted
- `AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` are set

### MCP server integration pattern
New MCP servers are added in two places:
1. `container/Dockerfile` — `RUN npm install -g <mcp-server-package>`
2. `container/agent-runner/src/runner-codex.ts` and `runner-claude.ts` — added to the `mcpServers` / `mcp_servers` config objects

The pattern is already established for Brave and Firecrawl.

### Skill system
Browser skills are defined in `container/skills/agent-browser/SKILL.md`. Additional skills can be added to `container/skills/` and they are synced into each group's `data/sessions/{group}/.claude/skills/` at each run.

---

## What the Researcher Should Deliver

A prioritized list of options, each with:
1. **What it is** and how it fits the architecture
2. **Effort estimate** (low/medium/high) — specifically whether it requires: container changes, new IPC message type, Discord router changes, or all three
3. **Limitations** — especially compatibility with Codex SDK + MiniMax model provider
4. **Recommended approach** — which option to implement first

The researcher should pay special attention to:
- Options that work with the **Codex SDK** (since the user believes this is the active SDK)
- Options that require **minimal NanoClaw changes** (drop-in MCP server) vs. **significant changes** (new IPC types, channel interface changes)
- Whether screenshot streaming to Discord is feasible without replacing `agent-browser` entirely





________________________________________


⏺ Here's the full research report. The most important finding is a constraint that shapes everything:                                                                               
                                                                                                                                                                                    
  ---                                                                                                                                                                               
  Critical Constraint: MiniMax Cannot Receive Image Input via Anthropic-Compat                                                                                                      
                                                                                                                                                                                    
  MiniMax's /anthropic endpoint explicitly rejects image content in tool results. Any tool that returns screenshots as image data to the model will fail with your current          
  ANTHROPIC_BASE_URL. This narrows every option below into two buckets: accessibility-tree based (works today) or vision-based (requires changing something).                       
                                                                                                                                                                                    
  ---                                                                                                                                                                               
  Tool-by-Tool Findings                                                                                                                                                           
                                                                                                                                                                                    
  @playwright/mcp (Microsoft Official) — Best Drop-In
                                                                                                                                                                                    
  - Two modes: Default (snapshot/accessibility tree, no screenshots to model) and vision (--caps=vision, sends base64 PNG to model).                                                
  - Headless Linux: Yes, Docker officially supported.                                                                                                                               
  - MiniMax compat: Snapshot mode works fully. Vision mode fails (images rejected).                                                                                                 
  - Effort: Very low — already the canonical example in Claude Agent SDK docs. One JSON config block.                                                                               
  - Version: v0.0.70, April 2026, actively maintained by Microsoft.                                                                                                                 
                                                                                                                                                                                    
  Chrome DevTools MCP (chrome-devtools-mcp) — Richest Evaluation Tool                                                                                                               
                                                                                                                                                                                    
  - What it is: Official Google/Chrome DevTools team MCP server. 34K GitHub stars, v0.21.0.                                                                                         
  - 33 tools: Screenshots, Lighthouse audits, performance traces, network debugging, console logs, memory snapshots — best-in-class for "evaluate UI visually and analytically."
  - Headless Linux: Yes, --headless flag.                                                                                                                                           
  - MiniMax compat: Accessibility + analysis tools work. Screenshot tool fails (image input rejected).
  - Effort: Low MCP drop-in, but requires running Chromium with remote debugging enabled.                                                                                           
                                                                                                                                                                                    
  Browserbase MCP + Stagehand — Best for Visual Evaluation, but Paid                                                                                                                
                                                                                                                                                                                    
  - Cloud browser service. Browser runs in Browserbase's infrastructure, your container connects remotely.                                                                          
  - CUA mode sends annotated screenshots to the model — genuinely visual. Also has DOM/accessibility mode.
  - MiniMax compat: DOM/act/extract mode works. CUA/vision mode fails.                                                                                                              
  - Pricing: Free tier is 1 browser-hour/month. Developer: $20/mo, 100 hours.                                                                                                       
  - Effort: Medium (API key + config). MCP drop-in for basic use.                                                                                                                   
                                                                                                                                                                                    
  Steel.dev MCP — Auto-Screenshots Per Action                                                                                                                                       
                                                                                                                                                                                    
  - Open-source, self-hostable. MCP server auto-captures annotated screenshots after each action.                                                                                   
  - Entirely screenshot-centric — which is its strength and its fatal flaw with MiniMax.
  - MiniMax compat: Blocked. Unusable in visual mode with current stack.                                                                                                            
  - Self-host pricing: Free (Apache 2.0). Cloud: $10 credits/month free.                                                                                                            
  - Effort: Low MCP drop-in, but pointless with MiniMax.                                                                                                                            
                                                                                                                                                                                    
  browser-use — Most Capable Visually, Hardest to Add                                                                                                                               
                  
  - Python-only library. Screenshot-driven, supports many providers via LangChain/LiteLLM.                                                                                          
  - Can use MiniMax's native API (not the Anthropic-compat layer) — this is the one path that makes screenshot-to-model work today without switching providers.
  - Integration: Python MCP sidecar in your container (adds Python dependency).                                                                                                     
  - Effort: High. Adds Python to Node.js stack, requires wrapping as MCP server.                                                                                                    
                                                                                                                                                                                    
  Anchorbrowser.io — Accessibility-Tree Only by Design                                                                                                                              
                                                                                                                                                                                    
  - Cloud browser, MCP drop-in. Explicitly no screenshots to model — designed for non-vision models.                                                                                
  - Works fine with MiniMax. Free tier: 5 credits/month.
  - Not useful for "judge visual appearance."                                                                                                                                       
                                                                                                                                                                                    
  xtr-dev/mcp-playwright-novnc — For Live Human Visibility
                                                                                                                                                                                    
  - Docker image bundling Playwright MCP + Xvfb + noVNC. Run it, open the noVNC URL in a browser, watch the agent's browser live.                                                   
  - Not for production — useful for debugging agent sessions visually.
  - Effort: Low (swap base image or run as sidecar).                                                                                                                                
                                                                                                                                                                                    
  Claude Agent SDK / Codex SDK — No Native Visual Tools                                                                                                                             
                                                                                                                                                                                    
  - Neither SDK has built-in computer-use for containers. Computer use in Codex is desktop-app-only (macOS).                                                                        
  - Both support MCP, so browser tools come via MCP attachments, not natively.
                                                                                                                                                                                    
  ---             
  Recommended Path                                                                                                                                                                  
                  
  ┌─────────────────────┬───────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │      Priority       │               What                │                                                        Why                                                        │
  ├─────────────────────┼───────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 1. Now              │ @playwright/mcp in snapshot mode  │ Zero-effort drop-in. Agents get rich accessibility tree; can reason about UI structure, labels, roles. Works with │
  │                     │                                   │  MiniMax today.                                                                                                   │
  ├─────────────────────┼───────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤   
  │ 2. Short-term       │ @playwright/mcp + disk            │ Take screenshots to disk, deliver via a new send_file IPC type to Discord. Human sees the screenshot; model uses  │
  │                     │ screenshots + IPC file delivery   │ the accessibility tree. Splits the work cleanly.                                                                  │   
  ├─────────────────────┼───────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 3. For real visual  │ Switch to MiniMax's native API    │ https://api.minimax.io/v1/chat/completions does support images. Route screenshot-analysis calls there directly,   │   
  │ judgment            │ for vision steps                  │ or use browser-use as a Python sidecar configured against the native endpoint.                                    │   
  ├─────────────────────┼───────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ 4. If you want      │ Browserbase DOM mode              │ Handles anti-bot pages, no local Chromium management. Vision mode unlocked once you fix the MiniMax image-input   │   
  │ cloud browsers      │                                   │ problem.                                                                                                          │   
  └─────────────────────┴───────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                                                                                    
  The cleanest short-term win is @playwright/mcp + a new send_file IPC message type in NanoClaw — agents take screenshots and pipe them to Discord for human visual review, while   
  the model itself reasons via accessibility tree. That unblocks the "judge visual appearance" workflow without needing a vision-capable model in the loop.



-----------------------------------------------------------

⏺ The research confirms what I expected. The short answer: headed, not headless — and this has direct implications for your containers.
                                                                                                                                                                                    
  Visual agents (screenshot-based, pixel-seeing ones) run browsers in headed mode with a virtual display (Xvfb on Linux). "Headless" is a misnomer that people often use loosely —  
  real visual agents need a rendering pipeline. The reasons:                                                                                                                        
                                                                                                                                                                                    
  - Some sites detect and block navigator.webdriver in headless mode                                                                                                                
  - Vision models perform measurably better on real pixel renders vs headless output (subtle CSS differences, WebGL, fonts)                                                         
  - Headed mode enables live debugging via VNC/video stream                                                                                                                         
                                                                                                                                                                                    
  What this means for NanoClaw containers specifically:                                                                                                                             
                                                                                                                                                                                    
  Your containers currently have no display server. agent-browser and @playwright/mcp both default to Playwright's headless: true — which works fine for accessibility-tree mode (no
   pixels involved), but for screenshot-based visual evaluation, you'd want headed mode with Xvfb.
                                                                                                                                                                                    
  The good news: the Playwright package already installed in your container image supports this. You'd just need to add Xvfb to the container image (apt-get install xvfb) and      
  launch it before the browser session. This is exactly what tools like browser-use do in Linux environments — they start Xvfb, point DISPLAY=:99 at it, and run a headed browser
  that renders real pixels to the virtual framebuffer.                                                                                                                              
                                                            
  So the full picture for getting genuine visual evaluation in NanoClaw containers:                                                                                                 
  1. ✅ Codex SDK → MiniMax base URL (just done)
  2. Add Xvfb to the container image + DISPLAY=:99 env setup                                                                                                                        
  3. Add a vision-capable browser MCP tool running in headed mode against that display