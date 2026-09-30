#!/usr/bin/env bash
# Reproduce the ESDB word lists used by Word Club (needs git, make, python3, sqlite3, network).
set -euo pipefail
WORK=${1:-$(mktemp -d)}
git clone https://github.com/en-wl/wordlist "$WORK/esdb"
cd "$WORK/esdb" && git checkout 1e5b7d3a72f47a71da5d28686c1dd4b397178485 && make >/dev/null
export_list() { ./scowl word-list "$1" B,Z 5 --wo-poses=abbr --categories= 2>/dev/null | grep -E '^[a-z]{2,24}$' | tr a-z A-Z | sort -u; }
export_list 60 > "$WORK/gb-esdb-v1.txt"
export_list 35 > "$WORK/gb-esdb-v1-size35.txt"
sha256sum "$WORK"/gb-esdb-v1*.txt
echo "Compare with public/dictionaries/gb-esdb-v1.manifest.json and data/dictionaries/gb-esdb-v1-size35.manifest.json"
