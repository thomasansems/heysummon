#!/bin/bash
# HeySummon — Add/register an expert
# Usage: add-expert.sh <api-key> [alias]
#
# Persists env-prefix-supplied HEYSUMMON_* vars into $SKILL_DIR/.env so that
# subsequent shells (e.g. `ask.sh`) see them without the prefix.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

ENV_FILE="$SKILL_DIR/.env"

# Capture env-prefix-supplied values BEFORE sourcing .env (so they override on merge).
_PREFIX_BASE_URL="${HEYSUMMON_BASE_URL-}"
_PREFIX_API_KEY="${HEYSUMMON_API_KEY-}"
_PREFIX_SUMMON_CONTEXT="${HEYSUMMON_SUMMON_CONTEXT-}"
_PREFIX_TIMEOUT="${HEYSUMMON_TIMEOUT-}"
_PREFIX_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL-}"
_PREFIX_TIMEOUT_FALLBACK="${HEYSUMMON_TIMEOUT_FALLBACK-}"
_PREFIX_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE-}"

# Load existing .env so we can merge (don't overwrite unrelated values).
[ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a

# Apply env-prefix overrides on top of the loaded values.
[ -n "$_PREFIX_BASE_URL" ]         && HEYSUMMON_BASE_URL="$_PREFIX_BASE_URL"
[ -n "$_PREFIX_API_KEY" ]          && HEYSUMMON_API_KEY="$_PREFIX_API_KEY"
[ -n "$_PREFIX_SUMMON_CONTEXT" ]   && HEYSUMMON_SUMMON_CONTEXT="$_PREFIX_SUMMON_CONTEXT"
[ -n "$_PREFIX_TIMEOUT" ]          && HEYSUMMON_TIMEOUT="$_PREFIX_TIMEOUT"
[ -n "$_PREFIX_POLL_INTERVAL" ]    && HEYSUMMON_POLL_INTERVAL="$_PREFIX_POLL_INTERVAL"
[ -n "$_PREFIX_TIMEOUT_FALLBACK" ] && HEYSUMMON_TIMEOUT_FALLBACK="$_PREFIX_TIMEOUT_FALLBACK"
[ -n "$_PREFIX_EXPERTS_FILE" ]     && HEYSUMMON_EXPERTS_FILE="$_PREFIX_EXPERTS_FILE"

# Escape a value for use inside a single-quoted shell string.
_esc_sq() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

# Rewrite .env from the merged set. Single-quoted values are safe for multi-line
# markdown (summon context) and are re-read cleanly by `set -a; source .env; set +a`.
write_env_var() {
  local key="$1" val="$2"
  [ -z "$val" ] && return 0
  printf "%s='%s'\n" "$key" "$(_esc_sq "$val")"
}

TMP_ENV="${ENV_FILE}.tmp.$$"
{
  write_env_var HEYSUMMON_BASE_URL         "${HEYSUMMON_BASE_URL-}"
  write_env_var HEYSUMMON_API_KEY          "${HEYSUMMON_API_KEY-}"
  write_env_var HEYSUMMON_TIMEOUT          "${HEYSUMMON_TIMEOUT-}"
  write_env_var HEYSUMMON_POLL_INTERVAL    "${HEYSUMMON_POLL_INTERVAL-}"
  write_env_var HEYSUMMON_TIMEOUT_FALLBACK "${HEYSUMMON_TIMEOUT_FALLBACK-}"
  write_env_var HEYSUMMON_EXPERTS_FILE     "${HEYSUMMON_EXPERTS_FILE-}"
  write_env_var HEYSUMMON_SUMMON_CONTEXT   "${HEYSUMMON_SUMMON_CONTEXT-}"
} > "$TMP_ENV" && mv "$TMP_ENV" "$ENV_FILE"

if [ -z "$1" ]; then
  echo "Usage: add-expert.sh <api-key> [alias]" >&2
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"

CLI_ARGS=(add-expert --key "$1")
[ -n "$2" ] && CLI_ARGS+=(--alias "$2")

exec $SDK_CLI "${CLI_ARGS[@]}"
