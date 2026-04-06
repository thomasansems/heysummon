#!/bin/bash
# Syncs the root package.json version to cli/ and packages/consumer-sdk/
# Usage: ./scripts/version-sync.sh [version]
# If no version argument is given, reads from root package.json.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "${1:-}" ]; then
  VERSION="$1"
else
  VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"
fi

echo "Syncing version $VERSION to sub-packages..."

for PKG_DIR in "$REPO_ROOT/cli" "$REPO_ROOT/packages/consumer-sdk"; do
  if [ -f "$PKG_DIR/package.json" ]; then
    node -e "
      const fs = require('fs');
      const path = '$PKG_DIR/package.json';
      const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
      pkg.version = '$VERSION';
      fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  Updated $(basename "$PKG_DIR")/package.json -> $VERSION"
  fi
done

echo "Done."
