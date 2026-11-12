#!/usr/bin/env bash
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"
OUT="${1:-/root/trading-backups}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT/trading-$STAMP.sql.gz"
UPLOADS="$OUT/trading-uploads-$STAMP.tar.gz"
# Caution: a shell redirection can create a partial file on failure; write atomically.
TMP="${FILE}.tmp"
UP_TMP="${UPLOADS}.tmp"
trap 'rm -f "$TMP" "$UP_TMP"' EXIT
docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 > "$TMP"
test -s "$TMP"
mv "$TMP" "$FILE"
docker compose exec -T web tar -C /app -czf - uploads > "$UP_TMP"
test -s "$UP_TMP"
mv "$UP_TMP" "$UPLOADS"
trap - EXIT
printf 'Database backup written to %s\nUpload backup written to %s\n' "$FILE" "$UPLOADS"
