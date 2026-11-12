#!/usr/bin/env bash
# Import a Notion "Markdown & CSV" export — trades and screenshots — into the
# local Docker test stack.
#
#   ./scripts/import-notion-into-dev.sh "<export.zip>" [--replace] [--dry-run] [--images-only]
#
# Why a staging folder: the importer runs on the host because only there is the
# export reachable, while the images must end up in the web container's uploads
# volume. A Docker volume is not a host directory on Docker Desktop, so the
# files are copied in afterwards and handed to the container's app user.
#
# The database is reached through the published port in compose.dev.yaml
# (127.0.0.1:55432); the credentials come from .env.dev.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env.dev"
COMPOSE=(docker compose -f compose.dev.yaml)
STAGING=".notion-uploads"

if [ $# -lt 1 ]; then
  printf 'Usage: %s <export.zip|folder> [--replace] [--dry-run] [--images-only]\n' "$0" >&2
  exit 1
fi

SOURCE="$1"
shift

[ -f "$SOURCE" ] || [ -d "$SOURCE" ] || { printf 'Not found: %s\n' "$SOURCE" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { printf 'Missing %s — run ./scripts/dev-stack.sh first.\n' "$ENV_FILE" >&2; exit 1; }
command -v docker >/dev/null || { printf 'docker is required.\n' >&2; exit 1; }

read_value() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^'//" -e "s/'$//"
}

DB_PASSWORD="$(read_value DEV_DB_PASSWORD)"
DB_NAME="$(read_value DEV_DB_NAME)"
DB_USER="$(read_value DEV_DB_USER)"

rm -rf "$STAGING"
mkdir -p "$STAGING"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

DRY_RUN=0
for argument in "$@"; do
  [ "$argument" = "--dry-run" ] && DRY_RUN=1
done

PGHOST=127.0.0.1 \
PGPORT=55432 \
DB_NAME="$DB_NAME" \
DB_USER="$DB_USER" \
DB_PASSWORD="$DB_PASSWORD" \
DASHBOARD_TIMEZONE="$(read_value DASHBOARD_TIMEZONE || echo Europe/Berlin)" \
UPLOAD_DIR="$PWD/$STAGING" \
  npx tsx scripts/import-notion-export.ts "$SOURCE" "$@"

if [ "$DRY_RUN" = "1" ]; then
  printf '\nDry run: nothing written to the database or the container.\n'
  exit 0
fi

count="$(find "$STAGING" -type f | wc -l | tr -d ' ')"
if [ "$count" = "0" ]; then
  printf '\nNo images were imported, so there is nothing to copy into the container.\n'
  exit 0
fi

export DEV_DB_PASSWORD="$DB_PASSWORD"
container="$("${COMPOSE[@]}" ps -q web)"
if [ -z "$container" ]; then
  printf 'The web container is not running. Start it with ./scripts/dev-stack.sh\n' >&2
  exit 1
fi

printf '\nCopying %s image(s) into the web container…\n' "$count"
docker exec "$container" mkdir -p /app/uploads
docker cp "$STAGING/." "$container:/app/uploads/"
docker exec -u root "$container" chown -R appuser:appgroup /app/uploads
printf 'Done. Reload http://127.0.0.1:3000/journal — the screenshots are in the Screenshot column.\n'
