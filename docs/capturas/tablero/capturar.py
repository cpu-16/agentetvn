# Capturas del Tablero con Playwright (Python): vista completa a 1440 y 390 y tres interacciones.
#   python3 docs/capturas/tablero/capturar.py http://127.0.0.1:3011
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3011"
OUT = Path(__file__).parent
PIN = "tvn2026"

def entrar(ctx):
    r = ctx.request.post(f"{BASE}/api/entrar", data={"nombre": "Gilberto", "rol": "editor", "pin": PIN})
    assert r.ok, r.text()

def abrir_tablero(page):
    page.goto(BASE, wait_until="networkidle")
    page.get_by_role("button", name="Tablero", exact=True).first.click()
    page.wait_for_selector("figure", timeout=20000)
    page.wait_for_function("document.querySelectorAll('figure svg').length >= 8", timeout=30000)
    time.sleep(1.2)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="es-PA", timezone_id="America/Panama")
    entrar(ctx)
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(str(e)))
    page.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
    abrir_tablero(page)
    page.screenshot(path=str(OUT / "tablero-1440.png"), full_page=True)
    print("scrollWidth 1440:", page.evaluate("document.documentElement.scrollWidth"))

    # 1 · brush en la línea de tiempo (primera figura)
    fig = page.locator("figure").nth(0).locator("[role=img]")
    box = fig.bounding_box()
    y = box["y"] + box["height"] * 0.45
    page.mouse.move(box["x"] + box["width"] * 0.30, y)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.55, y, steps=12)
    page.mouse.up()
    time.sleep(1.0)
    page.screenshot(path=str(OUT / "tablero-brush-1440.png"), full_page=True)
    print("filtros tras brush:", page.locator("[aria-label='Filtros activos']").inner_text()[:160])
    if page.get_by_role("button", name="Limpiar").count(): page.get_by_role("button", name="Limpiar").click()
    time.sleep(0.6)

    # 2 · clic en un tema del treemap (segunda figura)
    page.locator("figure").nth(1).locator("svg text", has_text="Economía").first.click(force=True)
    time.sleep(1.0)
    page.screenshot(path=str(OUT / "tablero-treemap-1440.png"), full_page=True)
    print("filtros tras treemap:", page.locator("[aria-label='Filtros activos']").inner_text()[:160])
    if page.get_by_role("button", name="Limpiar").count(): page.get_by_role("button", name="Limpiar").click()
    time.sleep(0.6)

    # 3 · cambio de indicador (Banco Mundial)
    sel = page.locator("figure").filter(has_text="Contexto oficial").locator("select")
    sel.select_option(index=2)
    time.sleep(0.9)
    page.locator("figure").filter(has_text="Contexto oficial").screenshot(path=str(OUT / "tablero-indicador-1440.png"))

    # 4 · tabla accesible
    page.locator("figure").nth(2).get_by_role("button", name="Ver como tabla").click()
    time.sleep(0.4)
    page.locator("figure").nth(2).screenshot(path=str(OUT / "tablero-tabla-1440.png"))

    # 5 · móvil
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, locale="es-PA", timezone_id="America/Panama")
    entrar(ctx2)
    m = ctx2.new_page()
    m.on("pageerror", lambda e: errores.append("movil: " + str(e)))
    abrir_tablero(m)
    ancho = m.evaluate("document.documentElement.scrollWidth")
    print("scrollWidth 390:", ancho)
    m.screenshot(path=str(OUT / "tablero-390.png"), full_page=True)
    print("errores:", errores[:5] if errores else "ninguno")
    b.close()
