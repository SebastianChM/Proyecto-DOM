#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")/../infra/docker" && pwd)"

cd "$COMPOSE_DIR"
docker compose --env-file .env "$@" postgres redis
