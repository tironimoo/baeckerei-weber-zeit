#!/usr/bin/env bash
# Lokale Prüfung der Datenbank: braucht PostgreSQL (psql) und PostgREST. Siehe docs/ENTWICKLUNG.md
set -e
cd "$(dirname "$0")/../.."
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5544} PGUSER=${PGUSER:-pgtest}
echo "== Zugriffsregeln (SQL)"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -q -c "drop database if exists t" -c "create database t" 2>/dev/null
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d t -q -v ON_ERROR_STOP=1 -f tests/db/auth-stub.sql
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d t -q -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d t -q -f tests/db/rls-tests.sql 2>&1 | grep -E "FEHLER|bestanden" || true
echo "== Datenschicht der App (PostgREST)"
node tests/db/live.mjs
