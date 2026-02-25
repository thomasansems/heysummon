#!/bin/bash
# Run Playwright tests, convert videos to mp4, output paths for agent to send
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🎭 Running Playwright dashboard walkthrough..."
npx playwright test tests/e2e/dashboard-walkthrough.spec.ts --reporter=line --workers=1

echo ""
echo "📹 Converting videos to mp4..."

OUTDIR="/tmp/playwright-heysummon"
VIDEOS=()

for webm in "$OUTDIR"/*/video.webm; do
  [ -f "$webm" ] || continue
  dir=$(basename "$(dirname "$webm")")
  mp4="$OUTDIR/${dir}.mp4"
  ffmpeg -i "$webm" -c:v libx264 -preset fast -crf 23 "$mp4" -y 2>/dev/null
  VIDEOS+=("$mp4")
done

if [ ${#VIDEOS[@]} -eq 0 ]; then
  echo "⚠️ No videos found"
  exit 1
fi

echo ""
echo "✅ Videos ready:"
for v in "${VIDEOS[@]}"; do
  echo "VIDEO:$v"
done

# Find the full walkthrough video specifically
WALKTHROUGH=$(find "$OUTDIR" -name "*.mp4" -path "*click-every*" 2>/dev/null | head -1)
if [ -n "$WALKTHROUGH" ]; then
  echo "WALKTHROUGH:$WALKTHROUGH"
fi
