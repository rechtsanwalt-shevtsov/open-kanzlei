#!/usr/bin/env bash
# OpenKanzlei — Backend + Frontend für lokale Entwicklung starten/neu starten.
#
# Verwendung:
#   ./dev.sh              # stoppen (falls läuft), Backend bauen, beides starten
#   ./dev.sh start        # wie oben
#   ./dev.sh restart      # wie oben
#   ./dev.sh stop         # Prozesse auf Port 3000 und 5173 beenden
#   ./dev.sh build        # nur Backend kompilieren
#
# Voraussetzungen: Node.js 20+, npm install in backend/ und frontend/react-app/
# Datenbank: docker compose up -d (separat)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT}/backend"
FRONTEND_DIR="${ROOT}/frontend/react-app"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PID_FILE="${ROOT}/.dev.pids"

log() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

stop_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill ${pids} 2>/dev/null || true
      sleep 0.3
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  else
    warn "weder fuser noch lsof gefunden — Port ${port} wird nicht automatisch freigegeben"
  fi
}

stop_dev() {
  log "Beende laufende Dev-Server (Port ${BACKEND_PORT}, ${FRONTEND_PORT})…"
  if [[ -f "${PID_FILE}" ]]; then
    while read -r pid _; do
      [[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
    done < "${PID_FILE}" || true
    rm -f "${PID_FILE}"
  fi
  stop_port "${BACKEND_PORT}"
  stop_port "${FRONTEND_PORT}"
  sleep 0.5
}

check_dirs() {
  [[ -d "${BACKEND_DIR}" ]] || err "Backend nicht gefunden: ${BACKEND_DIR}"
  [[ -d "${FRONTEND_DIR}" ]] || err "Frontend nicht gefunden: ${FRONTEND_DIR}"
  [[ -f "${ROOT}/.env" ]] || warn "Keine .env im Projektroot — cp .env.example .env"
  [[ -d "${BACKEND_DIR}/node_modules" ]] || warn "backend: npm install ausführen"
  [[ -d "${FRONTEND_DIR}/node_modules" ]] || warn "frontend: npm install ausführen"
}

build_backend() {
  log "Backend kompilieren (npm run build)…"
  (cd "${BACKEND_DIR}" && npm run build)
}

start_dev() {
  check_dirs
  stop_dev
  build_backend

  : > "${PID_FILE}"

  log "Backend starten → http://localhost:${BACKEND_PORT}"
  (
    cd "${BACKEND_DIR}"
    export PORT="${BACKEND_PORT}"
    exec npm run dev
  ) &
  echo "$! backend" >> "${PID_FILE}"

  log "Frontend starten → http://localhost:${FRONTEND_PORT}"
  (
    cd "${FRONTEND_DIR}"
    exec npm run dev -- --port "${FRONTEND_PORT}" --strictPort
  ) &
  echo "$! frontend" >> "${PID_FILE}"

  log "Beide Dienste laufen. Beenden mit Ctrl+C oder: ./dev.sh stop"
  echo ""

  cleanup_on_exit() {
    log "Beende Dev-Server…"
    stop_dev
  }
  trap cleanup_on_exit INT TERM

  wait
}

cmd="${1:-restart}"
case "${cmd}" in
  start|restart|"")
    start_dev
    ;;
  stop)
    stop_dev
    log "Gestoppt."
    ;;
  build)
    check_dirs
    build_backend
    log "Build fertig."
    ;;
  *)
    err "Unbekannter Befehl: ${cmd} (start | restart | stop | build)"
    ;;
esac
