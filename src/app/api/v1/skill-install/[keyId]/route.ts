import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const { keyId } = await params;

  // Look up the key by ID (public endpoint — URL is the secret)
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: {
      id: true,
      key: true,
      isActive: true,
      scope: true,
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only client keys should be used for skill installs
  if (apiKey.scope === "provider") {
    return NextResponse.json({ error: "Invalid key type" }, { status: 400 });
  }

  // Detect the base URL from the incoming request
  const requestUrl = new URL(request.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

  // Return a shell script that installs the skill via ClawHub and configures the env
  const script = `#!/bin/bash
# HeySummon Skill Installer
# Generated for: ${baseUrl}
# Run with: curl -sL <this-url> | bash

set -e

echo ""
echo "🦞 HeySummon Skill Installer"
echo "================================"
echo ""

# Step 1: Install skill via ClawHub
echo "📦 Installing HeySummon skill via ClawHub..."
npx clawhub@latest install heysummon

# Step 2: Find the installed skill directory
SKILL_DIR=""
SEARCH_PATHS=(
  "$HOME/clawd/skills/heysummon"
  "$HOME/.openclaw/skills/heysummon"
  "$(pwd)/skills/heysummon"
)

for p in "\${SEARCH_PATHS[@]}"; do
  if [ -d "$p" ]; then
    SKILL_DIR="$p"
    break
  fi
done

if [ -z "$SKILL_DIR" ]; then
  # Try to find it dynamically
  SKILL_DIR=$(find "$HOME" -maxdepth 5 -type d -name "heysummon" 2>/dev/null | grep -v node_modules | head -1)
fi

if [ -z "$SKILL_DIR" ]; then
  echo ""
  echo "⚠️  Could not locate skill directory automatically."
  echo "   Please create the .env file manually in your HeySummon skill folder:"
  echo ""
  echo "   HEYSUMMON_BASE_URL=${baseUrl}"
  echo "   HEYSUMMON_API_KEY=${apiKey.key}"
  echo "   HEYSUMMON_NOTIFY_MODE=message"
  echo "   HEYSUMMON_NOTIFY_TARGET=<your_chat_id>"
  echo ""
  exit 0
fi

# Step 3: Write .env with pre-configured values
echo ""
echo "⚙️  Configuring skill at: $SKILL_DIR"
echo ""

cat > "$SKILL_DIR/.env" <<EOF
HEYSUMMON_BASE_URL=${baseUrl}
HEYSUMMON_API_KEY=${apiKey.key}
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=
EOF

echo "✅ Skill installed and configured!"
echo ""
echo "   One last step: set your HEYSUMMON_NOTIFY_TARGET in:"
echo "   $SKILL_DIR/.env"
echo ""
echo "   Then start the watcher:"
echo "   bash $SKILL_DIR/scripts/setup.sh"
echo ""
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
