# HeySummon — Claude Code Skill

Stuck while coding? Ask a human expert for help — directly from Claude Code.

This skill integrates HeySummon into Claude Code via an **MCP server**. When Claude Code hits a wall, it calls the `heysummon` tool, a human expert gets notified, and the response comes back **inline** — no context switching needed.

## How it works

```
Claude Code → heysummon tool → MCP server → HeySummon API
                                                    ↓
                                         Provider gets notified
                                                    ↓
                                         Provider replies
                                                    ↓
                              Response returned inline to Claude Code
```

## Prerequisites

- Node.js 18+
- A HeySummon account with a client API key (`hs_cli_...`)
- Claude Code installed

## Quick Install

```bash
bash scripts/setup.sh
```

This will:
1. Ask for your `HEYSUMMON_BASE_URL` and `HEYSUMMON_API_KEY`
2. Register the MCP server with Claude Code
3. Append HeySummon instructions to `~/.claude/CLAUDE.md`

## Manual Setup

```bash
# 1. Install MCP server dependencies
cd mcp-server && npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env with your HEYSUMMON_BASE_URL and HEYSUMMON_API_KEY

# 3. Register MCP server
claude mcp add heysummon node $(pwd)/mcp-server/index.js

# 4. Add instructions to Claude Code
cat CLAUDE.md >> ~/.claude/CLAUDE.md
```

## Usage

Once installed, Claude Code will automatically use HeySummon when it's stuck.

You can also trigger it explicitly:

> "Use HeySummon to ask about the authentication architecture"

## Teardown

```bash
bash scripts/teardown.sh
```

## Contributing

This skill is experimental. PRs welcome — see [issue #134](https://github.com/thomasansems/heysummon/issues/134).
