# Async Response Delivery

## Problem

When a human doesn't respond within the 15-minute blocking poll timeout, the response is lost. The agent moves on and never receives the answer.

## Solution

A file-based inbox system with a PM2 persistent watcher captures responses that arrive after the timeout.

## How It Works

### Blocking mode (default)

```bash
bash scripts/ask.sh "question"
```

1. Submits request to HeySummon API
2. Polls for up to 15 minutes
3. If response arrives → returns on stdout
4. If timeout → saves to `pending/` for the watcher to continue tracking
5. Outputs TIMEOUT message with note that watcher will capture it

### Async mode

```bash
bash scripts/ask.sh --async "question"    # submit, return immediately
bash scripts/ask.sh --check               # check inbox later
```

1. Submits request, saves to `pending/`, returns immediately
2. PM2 watcher polls pending requests every 3 seconds
3. On response → writes to `inbox/`, removes from `pending/`
4. `--check` reads inbox, outputs responses, archives files

## Directory Structure

```
pending/          Active requests awaiting response
  {requestId}.json    {"requestId", "refCode", "question", "provider", "submittedAt"}

inbox/            Received responses
  {requestId}.json    {"requestId", "refCode", "question", "response", "provider", "respondedAt"}
  archive/            Processed responses (history)

logs/             Watcher logs
  watcher.log
```

## PM2 Watcher

The watcher (`watcher.js`) is a zero-dependency Node.js script:
- Reads `.env` for API config
- Polls all `pending/*.json` requests
- Uses built-in `http`/`https` modules (no npm install needed)
- Writes responses to `inbox/`
- Graceful shutdown on SIGTERM/SIGINT

PM2 name: `heysummon-cc-watcher` (distinct from OpenClaw's `heysummon-watcher`)

### Lifecycle

```bash
bash scripts/setup-watcher.sh start     # start via PM2 (or nohup)
bash scripts/setup-watcher.sh stop      # stop
bash scripts/setup-watcher.sh restart   # restart
bash scripts/setup-watcher.sh status    # show status + counts
bash scripts/setup-watcher.sh logs      # tail log
```
