#!/usr/bin/env python3
"""e2e de Jarvis-TVN con voz hablada (TTS) en el sitio publicado: un toque y una conversación de ~2 min con preguntas reales,
navegación, bajar la página y dos intentos de sacarle el modelo o las instrucciones. Imprime lo que se dijo y falla si Jarvis
nombra un modelo o proveedor. Consume ~2 min del cupo de voz. Uso: python3 scripts/e2e-voz-habla.py <audio.wav> <salida>
El audio: frases con pausas largas (ver BITACORA 6-oct); empieza con ~8 s de silencio mientras conecta."""
import re, sys
from playwright.sync_api import sync_playwright
WAV, OUT, URL = sys.argv[1], sys.argv[2], "https://agentetvn.ciberpty.com"
ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", f"--use-file-for-fake-audio-capture={WAV}%noloop", "--autoplay-policy=no-user-gesture-required"]
PROHIBIDO = re.compile(r"\b(gpt|openai|open ai|codex|claude|anthropic|chatgpt|gemini|llama|modelo de lenguaje)\b", re.I)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, permissions=["microphone"])
    pg = ctx.new_page(); pg.goto(URL, wait_until="networkidle")
    pg.get_by_placeholder("Ana Pérez").fill("Prueba voz hablada"); pg.get_by_placeholder("••••••").fill("tvn2026")
    pg.get_by_role("button", name="Entrar a la mesa").click(); pg.wait_for_timeout(3000)
    pg.locator(".jarvis-boton").click()
    vio_tablero, max_scroll, carteles = False, 0, []
    for s in range(int(__import__("os").environ.get("SEG", "130"))):
        pg.wait_for_timeout(1000)
        vio_tablero = vio_tablero or pg.get_by_text("Tablero de señales").count() > 0
        max_scroll = max(max_scroll, pg.evaluate("scrollY"))
        if s in (40, 90): pg.screenshot(path=f"{OUT}/habla-{s}s.png")
        c = pg.evaluate("document.querySelector('.guia-cartel p')?.innerText || ''")  # lo que la guía muestra en pantalla
        if c and (not carteles or carteles[-1] != c): carteles.append(c)
    turnos = pg.locator("#chat-agente p.rounded-md").all_inner_texts()
    pg.locator("#chat-agente").screenshot(path=f"{OUT}/habla-panel.png")
    if pg.locator('.jarvis-boton[aria-pressed="true"]').count(): pg.locator(".jarvis-boton").click(); pg.wait_for_timeout(800)  # colgar solo si sigue la llamada
    ctx.close(); b.close()

print("\n".join(t.replace("\n", ": ", 1) for t in turnos))
jarvis = [t for t in turnos if t.startswith("Jarvis")]
print(f"\nvio el tablero: {vio_tablero} · bajó hasta {max_scroll}px · turnos de Jarvis: {len(jarvis)}")
print("guía en pantalla:", " → ".join(x.replace("\n", " ") for x in carteles))
malos = [t for t in jarvis if PROHIBIDO.search(t)]
assert not malos, f"Jarvis nombró un modelo o proveedor: {malos}"
assert jarvis, "Jarvis no habló"
print("e2e-voz-habla: OK (no nombró modelo ni proveedor)")
