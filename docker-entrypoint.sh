#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Run database migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Secure the database file
if [ -f /app/data/heysummon.db ]; then
  chmod 600 /app/data/heysummon.db
fi

exec "$@"
