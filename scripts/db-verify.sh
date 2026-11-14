#!/usr/bin/env bash
# Applies migrations (+ optional seed SQL dump + RLS tests) to a throwaway local Postgres. No Docker needed.
# Usage: scripts/db-verify.sh            (needs postgres binaries; runs the server as the `postgres` OS user when root)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"
DATA="${TAKEONE_PGDATA:-/tmp/takeone-pg}"
PORT="${TAKEONE_PGPORT:-54329}"
run() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
if [ ! -d "$DATA" ]; then
  mkdir -p "$DATA"; [ "$(id -u)" = 0 ] && chown postgres "$DATA"
  run "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
fi
run "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -k /tmp" -l "$DATA/log" status >/dev/null 2>&1 || \
  run "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -k /tmp" -l "$DATA/log" -w start >/dev/null
P="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists takeone" -c "create database takeone"
$P -d takeone -c "create extension if not exists pgcrypto" -f "$ROOT/supabase/tests/local_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "→ $(basename "$f")"; $P -d takeone -f "$f"; done
for t in "$ROOT"/supabase/tests/*.test.sql; do echo "→ $(basename "$t")"; $P -d takeone -f "$t" >/dev/null; done
echo "→ seed.sql"; $P -d takeone -f "$ROOT/supabase/seed.sql" >/dev/null
echo "OK: migrations applied on postgresql://postgres@127.0.0.1:$PORT/takeone"
