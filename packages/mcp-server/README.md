# @heysummon/mcp

MCP server for [HeySummon](https://heysummon.ai) — lets any MCP-compatible AI tool (Claude Code, Cursor, Windsurf, etc.) request help from a human expert inline.

## Install

```bash
npx @heysummon/mcp
```

Or with Claude Code:

```bash
claude mcp add heysummon npx @heysummon/mcp
```

## Configuration

Create a `.env` file or set environment variables:

```env
HEYSUMMON_BASE_URL=https://heysummon.ai
HEYSUMMON_API_KEY=hs_key_...
```

## Tools

| Tool | Description |
|---|---|
| `heysummon` | Submit a help request and wait for a response inline |
| `heysummon_status` | Check status of an existing request |
| `heysummon_providers` | List available providers |
