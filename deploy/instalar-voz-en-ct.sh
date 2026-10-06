#!/bin/bash
# Corre DENTRO de css-llamada. Instala/reinicia agentetvn-voz cuidando la voz de la CSS: si la CSS no está sana ANTES, no
# hace nada; si deja de estar sana DESPUÉS, apaga SOLO agentetvn-voz. Todo ocurre aquí, aunque se caiga la sesión SSH.
set -u
salud() { echo "css: $(systemctl is-active css-codex css-llamada | tr '\n' ' ')estado=$(curl -s -m 5 -X POST http://127.0.0.1:8795/estado) refresh=$(journalctl -u css-codex --since -15min --no-pager | grep -ci 'refresh token')"; }
SANA="css: active active estado=ok refresh=0"
antes=$(salud); echo "[antes] $antes"
[ "$antes" = "$SANA" ] || { echo "La voz de la CSS no está sana ANTES: no toco nada."; exit 2; }
cd /opt/agentetvn-voz && python3 puente.py --check >/dev/null || { echo "--check falló en el CT: no instalo"; exit 3; }
echo "--check en css-llamada: OK"
retirar() { echo "Retiro agentetvn-voz: $1"; systemctl disable --now agentetvn-voz; exit 1; }
systemctl daemon-reload && systemctl enable -q agentetvn-voz && systemctl restart agentetvn-voz || retirar "no arrancó"
sleep 15
systemctl is-active -q agentetvn-voz || retirar "agentetvn-voz no quedó activo ($(journalctl -u agentetvn-voz -n 3 --no-pager -o cat | tr '\n' ' '))"
despues=$(salud); echo "[después] $despues"
[ "$despues" = "$SANA" ] || retirar "la voz de la CSS dejó de estar sana"
journalctl -u agentetvn-voz -n 4 --no-pager -o cat
echo "agentetvn-voz instalado; la CSS sigue sana"
