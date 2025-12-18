#!/bin/bash
# scripts/infra.sh - Wrapper for docker-compose / docker compose

if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.dev.yml "$@"
elif docker compose version &> /dev/null; then
    docker compose -f docker-compose.dev.yml "$@"
else
    echo "❌ Docker Compose not found (tried 'docker-compose' and 'docker compose')."
    exit 1
fi
