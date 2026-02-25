#!/bin/bash
cd "$(dirname "$0")"
set -a
source .env.local
set +a
exec /home/thomasansems/bin/mercure run --config dev.Caddyfile
