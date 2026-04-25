#!/bin/bash
# HeySummon — shared helpers for skill scripts
#
# Resolves the canonical .env path. Sourced by ask.sh, setup.sh, add-expert.sh,
# list-experts.sh, check-status.sh.
#
# Read priority:
#   1. $HEYSUMMON_ENV_FILE if explicitly set and exists
#   2. $SKILL_DIR/.env                              (curl-only / project-local install)
#   3. $PWD/.claude/skills/heysummon/.env           (Claude Code plugin runtime)
#
# Write priority (for setup.sh / add-expert.sh):
#   1. $HEYSUMMON_ENV_FILE if explicitly set
#   2. $SKILL_DIR/.env if $SKILL_DIR is writable
#   3. $PWD/.claude/skills/heysummon/.env (created if missing)

heysummon_resolve_env_read() {
  if [ -n "${HEYSUMMON_ENV_FILE:-}" ] && [ -f "$HEYSUMMON_ENV_FILE" ]; then
    printf '%s\n' "$HEYSUMMON_ENV_FILE"
    return 0
  fi
  if [ -n "${SKILL_DIR:-}" ] && [ -f "$SKILL_DIR/.env" ]; then
    printf '%s\n' "$SKILL_DIR/.env"
    return 0
  fi
  local project_env="$PWD/.claude/skills/heysummon/.env"
  if [ -f "$project_env" ]; then
    printf '%s\n' "$project_env"
    return 0
  fi
  return 1
}

heysummon_load_env() {
  local env_file
  if env_file="$(heysummon_resolve_env_read)"; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
    HEYSUMMON_ENV_FILE="$env_file"
    export HEYSUMMON_ENV_FILE
  fi
}

heysummon_resolve_env_write() {
  if [ -n "${HEYSUMMON_ENV_FILE:-}" ]; then
    printf '%s\n' "$HEYSUMMON_ENV_FILE"
    return 0
  fi
  if [ -n "${SKILL_DIR:-}" ] && [ -w "$SKILL_DIR" ]; then
    printf '%s\n' "$SKILL_DIR/.env"
    return 0
  fi
  local project_dir="$PWD/.claude/skills/heysummon"
  mkdir -p "$project_dir" 2>/dev/null || true
  printf '%s\n' "$project_dir/.env"
}

heysummon_load_env
