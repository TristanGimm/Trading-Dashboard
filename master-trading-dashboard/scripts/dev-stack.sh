#!/usr/bin/env bash
# Start a local test stack: real PostgreSQL, real uploads, no production data.
#
#   ./scripts/dev-stack.sh          # create .env.dev on first run, then start
#   ./scripts/dev-stack.sh logs     # follow the web logs
#   ./scripts/dev-stack.sh reset    # delete the local database and uploads
#   ./scripts/dev-stack.sh down     # stop the stack, keep the data
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.dev"
CREDENTIALS=".dev-credentials.txt"
COMPOSE=(docker compose -f compose.dev.yaml)

require() {
  command -v "$1" >/dev/null 2>&1 || { printf 'Missing required command: %s\n' "$1" >&2; exit 1; }
}

require docker
require node

read_value() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^'//" -e "s/'$//"
}

random_token() {
  node -e 'process.stdout.write(require("crypto").randomBytes(Number(process.argv[1])).toString("hex"))' "$1"
}

create_env() {
  local db_password auth_secret password hash
  db_password="$(random_token 24)"
  auth_secret="$(random_token 32)"
  password="$(random_token 12)"
  hash="$(DEV_PASSWORD="$password" node --experimental-strip-types -e '
    import("./lib/auth-crypto.ts").then(async module => {
      process.stdout.write(await module.hashPassword(process.env.DEV_PASSWORD));
    });
  ')"
  umask 077
  cat >"$ENV_FILE" <<EOF
# Created by scripts/dev-stack.sh — local testing only. Never commit this file.
DASHBOARD_TIMEZONE=Europe/Berlin
PGHOST=db
PGPORT=5432
DB_NAME=trading
DB_USER=trading
DB_PASSWORD='${db_password}'
MAX_UPLOAD_MB=12
AUTH_USERNAME=tester
AUTH_PASSWORD_HASH='${hash}'
AUTH_SECRET='${auth_secret}'
DEV_DB_NAME=trading
DEV_DB_USER=trading
DEV_DB_PASSWORD='${db_password}'
DEV_LOGIN_PASSWORD=${password}
EOF
  umask 022
  {
    printf 'Local test login\n'
    printf '  URL:      http://127.0.0.1:3000/login\n'
    printf '  Username: tester\n'
    printf '  Password: %s\n' "$password"
    printf '\nGenerated %s. Delete that file (and .env.dev) to rotate the password.\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >"$CREDENTIALS"
  chmod 600 "$CREDENTIALS"
}

wait_for_web() {
  printf 'Waiting for the web container'
  for _ in $(seq 1 90); do
    if curl -fsS -o /dev/null http://127.0.0.1:3000/login 2>/dev/null; then
      printf ' ready.\n'
      return 0
    fi
    printf '.'
    sleep 2
  done
  printf '\nThe web container did not become ready. Check: %s logs\n' "${COMPOSE[*]}" >&2
  return 1
}

load_compose_env() {
  export DEV_DB_PASSWORD="$(read_value DEV_DB_PASSWORD)"
  export DEV_DB_NAME="$(read_value DEV_DB_NAME)"
  export DEV_DB_USER="$(read_value DEV_DB_USER)"
}

case "${1:-up}" in
  up)
    if [ ! -f "$ENV_FILE" ]; then
      printf 'Creating %s with generated credentials…\n' "$ENV_FILE"
      create_env
    fi
    load_compose_env
    "${COMPOSE[@]}" up -d --build
    wait_for_web
    printf '\n'
    cat "$CREDENTIALS"
    printf '\nDatabase psql:  docker compose -f compose.dev.yaml exec db psql -U trading -d trading\n'
    printf 'Status:         ./scripts/dev-stack.sh status\n'
    printf 'Stop:           ./scripts/dev-stack.sh down\n'
    printf 'Reset data:     ./scripts/dev-stack.sh reset\n'
    ;;
  logs)
    load_compose_env
    "${COMPOSE[@]}" logs -f --tail=100 web
    ;;
  status)
    load_compose_env
    "${COMPOSE[@]}" ps
    ;;
  down)
    load_compose_env
    "${COMPOSE[@]}" down
    ;;
  reset)
    load_compose_env
    printf 'This deletes the local test database and every uploaded screenshot.\n'
    read -r -p 'Continue? [y/N] ' answer
    case "$answer" in
      y|Y|yes|YES) "${COMPOSE[@]}" down -v ;;
      *) printf 'Cancelled.\n' ;;
    esac
    ;;
  *)
    printf 'Usage: %s [up|logs|status|down|reset]\n' "$0" >&2
    exit 2
    ;;
esac
