#!/bin/bash
# killclaw.sh - Stop all NanoClaw processes and containers

echo "Unloading com.nanoclaw launchd agent..."
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist 2>/dev/null
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.nanoclaw.plist 2>/dev/null || true

echo "Killing lingering NanoClaw Node processes..."
pkill -f 'node.*dist/src/index.js' 2>/dev/null

echo "Stopping nanoclaw-agent docker containers..."
docker ps -q --filter ancestor=nanoclaw-agent | xargs -r docker stop 2>/dev/null

echo "Terminating any stuck docker run commands..."
pkill -f 'docker run.*nanoclaw' 2>/dev/null

echo "NanoClaw processes killed."
