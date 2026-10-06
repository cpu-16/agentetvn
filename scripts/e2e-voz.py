#!/usr/bin/env python3
"""e2e de Jarvis-TVN en el sitio publicado: orbe y panel en 1440 y 390 px, «Explícame esta pantalla», conexión de voz con
micrófono falso, soltar fuera del orbe y navegación disparada por la herramienta (desde el CT, con el token interno).
Consume unos segundos de realtime. Uso: python3 scripts/e2e-voz.py <salida>"""
import subprocess, sys, time
from playwright.sync_api import sync_playwright
OUT, URL = sys.argv[1], "https://agentetvn.ciberpty.com"
ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"]

def entrar(pg):
    pg.goto(URL, wait_until="networkidle")
    pg.get_by_placeholder("Ana Pérez").fill("Prueba Jarvis"); pg.get_by_placeholder("••••••").fill("tvn2026")
    pg.get_by_role("button", name="Entrar a la mesa").click(); pg.wait_for_timeout(3000)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for ancho, alto, tag in [(1440, 900, "escritorio"), (390, 844, "celular")]:
        ctx = b.new_context(viewport={"width": ancho, "height": alto}, permissions=["microphone"], has_touch=(tag == "celular"))
        pg = ctx.new_page(); entrar(pg)
        orbe = pg.locator(".jarvis-boton"); caja = orbe.bounding_box()
        assert caja["width"] >= 44 and caja["height"] >= 44, caja
        assert caja["x"] + caja["width"] <= ancho and caja["y"] + caja["height"] <= alto, "orbe fuera de pantalla"
        orbe.click(); pg.wait_for_timeout(600)
        pg.get_by_role("button", name="Explícame esta pantalla").click()
        pg.get_by_text("Estás en la portada").first.wait_for(timeout=3000)
        pg.screenshot(path=f"{OUT}/jarvis-panel-{tag}.png")
        if tag == "escritorio":
            hilos = []
            pg.on("response", lambda r: hilos.append(r.headers.get("x-hilo")) if "/api/voz/offer" in r.url and r.ok else None)
            caja = orbe.bounding_box(); pg.mouse.move(caja["x"] + 28, caja["y"] + 28); pg.mouse.down(); pg.wait_for_timeout(5000)  # 1.ª vez conecta
            assert pg.locator('.orbe[data-estado="escuchando"]').count() >= 1, "mantener presionado debe escuchar"
            pg.screenshot(path=f"{OUT}/jarvis-escuchando.png")
            pg.mouse.move(caja["x"] - 300, caja["y"] - 300); pg.mouse.up(); pg.wait_for_timeout(600)  # soltar FUERA del orbe
            assert pg.locator('.orbe[data-estado="escuchando"]').count() == 0, "soltar fuera del orbe debe cerrar el micrófono"
            assert hilos and hilos[0], "la oferta de voz debe haber devuelto un hilo"
            cuerpo = '{"hilo":"%s","nombre":"navegar","args":{"destino":"tablero"}}' % hilos[0]
            remoto = ("cd /opt/agentetvn && T=$(grep ^VOZ_TOKEN= .env | cut -d= -f2) && curl -s -X POST http://127.0.0.1:3000/api/voz/herramienta "
                      "-H \"x-voz-token: $T\" -H content-type:application/json --data-binary @-")
            out = subprocess.run(["ssh", "prox", f"pct exec 130 -- bash -lc '{remoto}'"], input=cuerpo, capture_output=True, text=True, timeout=30).stdout
            assert "tablero" in out, out
            pg.get_by_text("Tablero de señales").first.wait_for(timeout=4000)  # la página navegó sola
        ctx.close()
    b.close()
print("e2e-voz: OK")
