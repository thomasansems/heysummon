#!/bin/bash
# Merge all HeySummon PRs in dependency order

set -e

PR_ORDER=("146" "143" "145" "148" "149" "150" "147" "121" "153" "154" "155" "156" "157" "141")

echo "=== Merge Order ==="
for pr in "${PR_ORDER[@]}"; do
  title=$(gh pr view $pr -q .title 2>/dev/null)
  echo "$pr: $title"
done

echo ""
echo "Merge all with: gh pr merge <pr> --admin --delete-branch"
echo ""
echo "Or do it manually via GitHub UI in this order:"
echo "1. #146 (tsconfig fix) — REQUIRED FIRST"
echo "2. #143 (UI redesign)"
echo "Then the rest can be in any order"
