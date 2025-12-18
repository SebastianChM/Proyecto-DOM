@echo off
docker compose version >nul 2>nul
IF NOT ERRORLEVEL 1 (
    docker compose -f docker-compose.dev.yml %*
) ELSE (
    docker-compose -f docker-compose.dev.yml %*
)
