#!/bin/bash
# Build, rebuild container, and restart NanoClaw service
set -e

BASE="$(cd "$(dirname "$0")/.." && pwd)"

echo "Cleaning stale dist..."
rm -rf "$BASE/dist"

echo "Building host code..."
cd "$BASE" && npm run build

echo "Rebuilding container image..."
"$BASE/container/build.sh"

SERVICE="gui/$(id -u)/com.nanoclaw"
PLIST="$HOME/Library/LaunchAgents/com.nanoclaw.plist"

if launchctl print "$SERVICE" &>/dev/null; then
  echo "Restarting service..."
  launchctl kickstart -k "$SERVICE"
else
  echo "Loading service..."
  launchctl load "$PLIST"
fi

echo "NanoClaw started."
