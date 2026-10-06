#!/bin/bash
# Despliega el puente de voz de Jarvis en css-llamada (prox3, CT 130) SIN tocar la voz de la CSS (css-codex, /opt/llamada).
# La verificación y la retirada corren DENTRO del CT (deploy/instalar-voz-en-ct.sh). Spec: revisión 6-oct 4:35 p. m.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 voz/puente.py --check >/dev/null && echo "--check local: OK"
TOKEN=$(ssh prox "pct exec 130 -- grep -oP '^VOZ_TOKEN=\K.+' /opt/agentetvn/.env")
[ ${#TOKEN} -ge 16 ] || { echo "falta VOZ_TOKEN en /opt/agentetvn/.env de AgenteTVN"; exit 1; }
tmp=$(mktemp -d); cp voz/puente.py voz/app_server_falso.py deploy/agentetvn-voz.service deploy/instalar-voz-en-ct.sh "$tmp/"
printf 'VOZ_TOKEN=%s\nNEXT_URL=https://agentetvn.ciberpty.com\nVOZ=maple\nMODELO=gpt-6-luna\n' "$TOKEN" > "$tmp/env"; chmod 600 "$tmp/env"
scp -q "$tmp"/* prox3:/tmp/ && rm -r "$tmp"
ssh prox3 "pct exec 130 -- mkdir -p /opt/agentetvn-voz && for f in puente.py app_server_falso.py instalar-voz-en-ct.sh; do pct push 130 /tmp/\$f /opt/agentetvn-voz/\$f; done && pct push 130 /tmp/env /opt/agentetvn-voz/.env --perms 600 && pct push 130 /tmp/agentetvn-voz.service /etc/systemd/system/agentetvn-voz.service && rm /tmp/puente.py /tmp/app_server_falso.py /tmp/instalar-voz-en-ct.sh /tmp/env /tmp/agentetvn-voz.service"
ssh prox3 "pct exec 130 -- bash /opt/agentetvn-voz/instalar-voz-en-ct.sh"
