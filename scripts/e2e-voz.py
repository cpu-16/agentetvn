#!/usr/bin/env python3
"""e2e de Jarvis-TVN en el sitio publicado: orbe y panel en 1440 y 390 px, «Explícame esta pantalla», un toque abre la voz
con micrófono falso y otro la cuelga, y navegación/desplazamiento disparados por la herramienta (desde el CT, con el token interno).
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
        pg.get_by_role("button", name="Escribirle a Jarvis").click(); pg.wait_for_timeout(600)
        pg.get_by_role("button", name="Explícame esta pantalla").click()
        pg.get_by_text("Estás en la portada").first.wait_for(timeout=3000)
        pg.screenshot(path=f"{OUT}/jarvis-panel-{tag}.png")
        if tag == "escritorio":
            hilos = []
            pg.on("response", lambda r: hilos.append(r.headers.get("x-hilo")) if "/api/voz/offer" in r.url and r.ok else None)
            orbe.click(); pg.wait_for_timeout(6000)  # un toque: conecta y escucha
            assert pg.locator('.orbe[data-estado="escuchando"]').count() >= 1, "un toque debe dejarlo escuchando"
            pg.wait_for_timeout(2500)
            assert pg.locator('.orbe[data-estado="escuchando"]').count() >= 1, "sin tocar nada, sigue escuchando"
            pg.screenshot(path=f"{OUT}/jarvis-escuchando.png")
            orbe.click(); pg.wait_for_timeout(800)  # otro toque: cuelga
            assert pg.locator('.orbe[data-estado="escuchando"]').count() == 0, "otro toque debe colgar"
            assert hilos and hilos[0], "la oferta de voz debe haber devuelto un hilo"
            orbe.click(); pg.wait_for_timeout(6000)  # de nuevo, para la navegación
            assert len(hilos) >= 2 and hilos[-1], "la segunda llamada debe tener hilo"
            hilos[0] = hilos[-1]
            cuerpo = '{"hilo":"%s","nombre":"navegar","args":{"destino":"tablero"}}' % hilos[0]
            remoto = ("cd /opt/agentetvn && T=$(grep ^VOZ_TOKEN= .env | cut -d= -f2) && curl -s -X POST http://127.0.0.1:3000/api/voz/herramienta "
                      "-H \"x-voz-token: $T\" -H content-type:application/json --data-binary @-")
            out = subprocess.run(["ssh", "prox", f"pct exec 130 -- bash -lc '{remoto}'"], input=cuerpo, capture_output=True, text=True, timeout=30).stdout
            assert "tablero" in out, out
            pg.get_by_text("Tablero de señales").first.wait_for(timeout=4000)  # la página navegó sola
            cuerpo = '{"hilo":"%s","nombre":"navegar","args":{"destino":"abajo"}}' % hilos[0]
            out = subprocess.run(["ssh", "prox", f"pct exec 130 -- bash -lc '{remoto}'"], input=cuerpo, capture_output=True, text=True, timeout=30).stdout
            assert "Bajé" in out, out
            pg.wait_for_timeout(2500)
            assert pg.evaluate("scrollY") > 200, "la página debe haber bajado"
            orbe.click(); pg.wait_for_timeout(800)
        ctx.close()
    b.close()
print("e2e-voz: OK")
