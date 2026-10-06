#!/usr/bin/env bash
# Despliega el repo (commit actual) al CT 130 `agentetvn` de prox: bundle git → pct push → build → systemd. Verifica por contenido.
set -euo pipefail
cd "$(dirname "$0")/.."
CT=130; NODO=prox; REF=$(git rev-parse --short HEAD)
git bundle create /tmp/agentetvn.bundle HEAD >/dev/null 2>&1
scp -q /tmp/agentetvn.bundle $NODO:/tmp/agentetvn.bundle
ssh $NODO "pct push $CT /tmp/agentetvn.bundle /tmp/agentetvn.bundle >/dev/null && pct push $CT /dev/stdin /tmp/agentetvn.service >/dev/null" < deploy/agentetvn.service
ssh $NODO "pct exec $CT -- bash -lc '
set -e
export PATH=/root/.bun/bin:\$PATH
if [ ! -d /opt/agentetvn/.git ]; then git clone -q /tmp/agentetvn.bundle /opt/agentetvn; fi
cd /opt/agentetvn
git fetch -q /tmp/agentetvn.bundle HEAD && git reset -q --hard FETCH_HEAD
[ -f .env ] || cp .env.example .env
bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1
[ -d .cache-modelos/Xenova ] || HF_HUB_OFFLINE=0 bun scripts/modelo-descargar.ts >/dev/null 2>&1
bun run db:push >/dev/null 2>&1
bun run build 2>&1 | grep -E \"Compiled|error\" || true
cp /tmp/agentetvn.service /etc/systemd/system/agentetvn.service
systemctl daemon-reload && systemctl enable -q agentetvn && systemctl restart agentetvn
sleep 4
bun run doctor 2>/dev/null | tail -n 1
curl -s -o /dev/null -w \"HTTP %{http_code}\\n\" http://127.0.0.1:3000/api/agenda
'"
echo "desplegado $REF en CT $CT"
