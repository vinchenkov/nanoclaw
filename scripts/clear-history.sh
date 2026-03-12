#!/bin/bash
# Delete all NanoClaw session history and task state

set -e

BASE="$HOME/Documents/dev/claws/NanoClaw"

rm -rf $BASE/data/sessions**
rm -rf $BASE/data/ipc/**
rm -rf $BASE/groups/shared/mission-control/**
rm -rf "$BASE/groups/homie/briefings/"
rm -rf "$BASE/groups/homie/logs/"
rm -rf "$BASE/groups/worker/logs/"
rm -rf "$BASE/groups/verifier/logs/"
rm -rf "$BASE/groups/shared/logs/"

echo "NanoClaw history cleared."
