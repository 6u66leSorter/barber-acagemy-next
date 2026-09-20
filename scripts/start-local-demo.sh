#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop не установлен. Установите Docker Desktop для macOS и повторите команду."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Запускаю Docker Desktop…"
  if docker desktop start >/dev/null 2>&1; then
    :
  else
    open -a Docker 2>/dev/null || true
  fi

  for attempt in {1..60}; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop не стал доступен за 2 минуты. Откройте его вручную и дождитесь статуса Running."
  exit 1
fi

docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
