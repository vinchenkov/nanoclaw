#!/bin/bash
# Delete all NanoClaw session history and task state

set -e

BASE="$HOME/Documents/dev/claws/NanoClaw"

rm -rf "$BASE/data/sessions/"
rm -rf "$BASE/data/ipc/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/"
rm -rf "$BASE/groups/homie/briefings/"
rm -rf "$BASE/groups/homie/logs/"
rm -rf "$BASE/groups/worker/logs/"
rm -rf "$BASE/groups/shared/logs/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/"

mkdir "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/"

echo "NanoClaw history cleared."
