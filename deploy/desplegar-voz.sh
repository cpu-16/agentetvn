#!/bin/bash
# Despliega el puente de voz de Jarvis en css-llamada (prox3, CT 130) SIN tocar la voz de la CSS (css-codex, /opt/llamada).
# Antes y después revisa la salud de la CSS; si algo de la CSS falla, apaga SOLO agentetvn-voz. Spec: revisión 6-oct 4:35 p. m.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 voz/puente.py --check >/dev/null && echo "--check local: OK"
TOKEN=$(ssh prox "pct exec 130 -- grep -oP '^VOZ_TOKEN=\K.+' /opt/agentetvn/.env")
[ ${#TOKEN} -ge 16 ] || { echo "falta VOZ_TOKEN en /opt/agentetvn/.env de AgenteTVN"; exit 1; }
salud_css() {  # $1 = momento
  ssh prox3 "pct exec 130 -- bash -c 'echo \"[$1] css: \$(systemctl is-active css-codex css-llamada | tr \"\n\" \" \")estado=\$(curl -s -m 5 -X POST http://127.0.0.1:8795/estado) refresh=\$(journalctl -u css-codex --since -15min --no-pager | grep -ci \"refresh token\")\"'"
}
salud_css antes
tmp=$(mktemp -d); cp voz/puente.py voz/app_server_falso.py deploy/agentetvn-voz.service "$tmp/"
printf 'VOZ_TOKEN=%s\nNEXT_URL=https://agentetvn.ciberpty.com\nVOZ=maple\nMODELO=gpt-6-luna\n' "$TOKEN" > "$tmp/env"; chmod 600 "$tmp/env"
scp -q "$tmp"/* prox3:/tmp/ && rm -r "$tmp"
ssh prox3 "pct exec 130 -- mkdir -p /opt/agentetvn-voz && for f in puente.py app_server_falso.py; do pct push 130 /tmp/\$f /opt/agentetvn-voz/\$f; done && pct push 130 /tmp/env /opt/agentetvn-voz/.env --perms 600 && pct push 130 /tmp/agentetvn-voz.service /etc/systemd/system/agentetvn-voz.service && rm /tmp/puente.py /tmp/app_server_falso.py /tmp/env /tmp/agentetvn-voz.service"
ssh prox3 "pct exec 130 -- bash -c 'cd /opt/agentetvn-voz && python3 puente.py --check >/dev/null && echo \"--check en css-llamada: OK\" && systemctl daemon-reload && systemctl enable -q agentetvn-voz && systemctl restart agentetvn-voz'"
sleep 15
ssh prox3 "pct exec 130 -- bash -c 'systemctl is-active agentetvn-voz; journalctl -u agentetvn-voz -n 5 --no-pager -o cat'"
s=$(salud_css después); echo "$s"
if ! echo "$s" | grep -q "css: active active estado=ok refresh=0"; then
  echo "¡La voz de la CSS no se ve sana! Apago agentetvn-voz."; ssh prox3 "pct exec 130 -- systemctl disable --now agentetvn-voz"; exit 1
fi
echo "puente de voz desplegado; la CSS sigue sana"
