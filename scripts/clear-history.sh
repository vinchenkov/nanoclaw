#!/bin/bash
# Delete all NanoClaw session history and task state

set -e

BASE="$HOME/Documents/dev/claws/NanoClaw"

rm -rf "$BASE/data/sessions/"
rm -rf "$BASE/data/ipc/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/initiatives/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/tasks/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/outputs/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/revisions/"
rm -f  "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/activity.log.ndjson"
rm -f  "/Users/vinchenkov/Documents/dev/claws/NanoClaw/groups/shared/mission-control/lock.json"
rm -rf "$BASE/groups/homie/briefings/"
rm -rf "$BASE/groups/homie/logs/"
rm -rf "$BASE/groups/worker/logs/"
rm -rf "$BASE/groups/shared/logs/"
rm -rf "/Users/vinchenkov/Documents/dev/claws/NanoClaw/data/sessions/"

echo "NanoClaw history cleared."
