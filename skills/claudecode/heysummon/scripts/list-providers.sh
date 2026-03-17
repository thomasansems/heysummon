#!/bin/bash
# HeySummon Claude Code Skill — List available providers
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
API_KEY="${HEYSUMMON_API_KEY:-}"

curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/providers" | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if (d.error) { console.log('❌', d.error); process.exit(1); }
const providers = d.providers || d;
if (!providers.length) { console.log('No providers registered.'); process.exit(0); }
console.log('Available providers:');
providers.forEach(p => {
  const avail = p.available !== false ? '🟢' : '🔴';
  console.log(\`  \${avail} \${p.name || p.providerName} (\${p.channel || 'openclaw'})\`);
});
" 2>/dev/null || echo "Could not fetch providers"
