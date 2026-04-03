#!/bin/bash
# HeySummon — List registered experts

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"

exec $SDK_CLI list-experts
