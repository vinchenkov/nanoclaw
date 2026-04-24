#!/bin/bash
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

docker run --rm -it \
  --user "$(id -u):$(id -g)" \
  -e HOME=/home/node \
  -v "$PROJECT/groups/critic:/workspace/group" \
  -v "$PROJECT/groups/global:/workspace/global:ro" \
  -v "$PROJECT/data/sessions/critic/.claude:/home/node/.claude" \
  -v "$PROJECT/data/sessions/critic/.codex:/home/node/.codex" \
  -v "$PROJECT/data/ipc/critic:/workspace/ipc" \
  -v "$PROJECT/data/sessions/critic/agent-runner-src:/app/src" \
  -v "$PROJECT/groups:/workspace/groups" \
  -v "$PROJECT/data/sessions:/workspace/sessions:ro" \
  -v "$PROJECT/.git:/workspace/.git" \
  --entrypoint bash \
  nanoclaw-agent:latest
