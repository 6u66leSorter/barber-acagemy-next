#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop не установлен. Установите Docker Desktop для macOS и повторите команду."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 недоступен. Обновите Docker Desktop и повторите команду."
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

pull_image() {
  local image="$1"

  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "Базовый образ уже загружен: $image"
    return 0
  fi

  for attempt in 1 2 3; do
    echo "Загружаю $image (попытка $attempt из 3)…"
    if docker pull "$image"; then
      return 0
    fi
    if [[ "$attempt" -lt 3 ]]; then
      sleep "$((attempt * 3))"
    fi
  done

  echo
  echo "Не удалось загрузить $image из Docker Hub."
  echo "Если выше указан TLS handshake timeout, проверьте Docker Desktop → Settings → Resources → Proxies."
  echo "Отключите неверный ручной proxy, выберите System proxy и при необходимости временно смените состояние VPN."
  echo "После исправления проверьте вручную: docker pull $image"
  return 1
}

pull_image "node:20-bookworm-slim"
pull_image "nginx:1.27-alpine"

compose_files=(-f docker-compose.yml -f docker-compose.local.yml)
build_completed=false
for attempt in 1 2; do
  echo "Собираю demo-контейнеры (попытка $attempt из 2)…"
  if docker compose "${compose_files[@]}" build; then
    build_completed=true
    break
  fi
  if [[ "$attempt" -lt 2 ]]; then
    echo "Сборка не завершилась. Повтор через 5 секунд…"
    sleep 5
  fi
done

if [[ "$build_completed" != "true" ]]; then
  echo "Сборка demo-контейнеров завершилась ошибкой. Проверьте вывод выше; приложение не запущено."
  exit 1
fi

docker compose "${compose_files[@]}" up
