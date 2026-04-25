#!/bin/bash
# HeySummon — List registered experts

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"
source "$SCRIPT_DIR/_lib.sh"

export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"

exec $SDK_CLI list-experts
