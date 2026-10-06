#!/usr/bin/env bash
# Sondea GDELT cada 2 min; cuando responda 200, corre la ingesta completa. Log en data/raw/.
cd "$(dirname "$0")/.."
URL='https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang:spanish&mode=artlist&maxrecords=5&format=json&timespan=1d'
while :; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$URL")
  echo "$(date -u +%H:%M:%S) gdelt $code"
  [ "$code" = "200" ] && break
  sleep 120
done
bun scripts/ingesta.ts
