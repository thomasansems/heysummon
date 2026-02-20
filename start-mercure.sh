#!/bin/bash
# Start Mercure hub for local development
# Requires: ~/bin/mercure (download from https://github.com/dunglas/mercure/releases)

export MERCURE_JWT_SECRET="${MERCURE_JWT_SECRET:-dev-mercure-secret-change-me-in-production}"

exec ~/bin/mercure run --config dev.Caddyfile
