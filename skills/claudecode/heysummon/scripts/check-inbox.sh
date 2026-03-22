#!/bin/bash
# HeySummon Claude Code Skill — Check inbox for pending responses
#
# Usage:
#   check-inbox.sh            — Show all pending responses
#   check-inbox.sh --quiet    — Only output if there are responses (for hooks)
#
# Reads inbox/*.json files, outputs formatted responses, and archives them.
# Returns exit 0 if responses found, exit 1 if empty.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INBOX_DIR="$SKILL_DIR/inbox"
ARCHIVE_DIR="$INBOX_DIR/archive"
PENDING_DIR="$SKILL_DIR/pending"

QUIET=false
[ "$1" = "--quiet" ] && QUIET=true

# Ensure directories exist
mkdir -p "$INBOX_DIR" "$ARCHIVE_DIR"

# Check for responses in inbox
INBOX_FILES=$(find "$INBOX_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | sort)

if [ -z "$INBOX_FILES" ]; then
  # Also report pending count if not quiet
  if [ "$QUIET" = "false" ]; then
    PENDING_COUNT=$(find "$PENDING_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l)
    PENDING_COUNT=$(echo "$PENDING_COUNT" | tr -d ' ')
    if [ "$PENDING_COUNT" -gt 0 ] 2>/dev/null; then
      echo "No responses yet. $PENDING_COUNT request(s) still pending."
    else
      echo "Inbox empty. No pending requests."
    fi
  fi
  exit 1
fi

# Process each response
FOUND=0
for FILE in $INBOX_FILES; do
  ENTRY=$(cat "$FILE" 2>/dev/null)
  [ -z "$ENTRY" ] && continue

  REF=$(echo "$ENTRY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.refCode||j.requestId||'?')}catch(e){process.stdout.write('?')}})" 2>/dev/null)
  QUESTION=$(echo "$ENTRY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).question||'')}catch(e){}})" 2>/dev/null)
  RESPONSE=$(echo "$ENTRY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).response||'')}catch(e){}})" 2>/dev/null)
  PROVIDER=$(echo "$ENTRY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).provider||'unknown')}catch(e){process.stdout.write('unknown')}})" 2>/dev/null)

  if [ -n "$RESPONSE" ]; then
    FOUND=$((FOUND + 1))
    echo "--- HeySummon Response [$REF] ---"
    echo "From: $PROVIDER"
    if [ -n "$QUESTION" ]; then
      echo "Question: $QUESTION"
    fi
    echo "Response: $RESPONSE"
    echo "---"
    echo ""
  fi

  # Move to archive
  mv "$FILE" "$ARCHIVE_DIR/" 2>/dev/null
done

if [ "$FOUND" -eq 0 ]; then
  [ "$QUIET" = "false" ] && echo "Inbox empty."
  exit 1
fi

exit 0
