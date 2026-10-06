#!/usr/bin/env python3
"""App-server falso para `puente.py --check`: contesta el JSON-RPC mínimo y, al arrancar el realtime, pide dos
herramientas (una permitida y una inventada). Las respuestas del puente a esas herramientas se anotan en FALSO_LOG."""
import json, os, sys

n, log = 0, os.environ.get("FALSO_LOG", "/tmp/falso.log")
def enviar(m): sys.stdout.write(json.dumps(m) + "\n"); sys.stdout.flush()
for linea in sys.stdin:
    m = json.loads(linea); metodo, p = m.get("method"), m.get("params") or {}
    if "id" in m and metodo is None:  # respuesta del puente a una herramienta
        open(log, "a").write(json.dumps(m) + "\n"); continue
    if metodo == "initialize": enviar({"jsonrpc": "2.0", "id": m["id"], "result": {}})
    elif metodo == "thread/start":
        n += 1; enviar({"jsonrpc": "2.0", "id": m["id"], "result": {"thread": {"id": f"hilo-prueba-{n}"}}})
    elif metodo == "thread/realtime/start":
        enviar({"jsonrpc": "2.0", "id": m["id"], "result": {}})
        enviar({"jsonrpc": "2.0", "method": "thread/realtime/sdp", "params": {"threadId": p["threadId"], "sdp": "v=0 falso"}})
        enviar({"jsonrpc": "2.0", "id": 9001, "method": "item/tool/call", "params": {"threadId": p["threadId"], "tool": "navegar", "arguments": {"destino": "tablero"}}})
        enviar({"jsonrpc": "2.0", "id": 9002, "method": "item/tool/call", "params": {"threadId": p["threadId"], "tool": "borrar_todo", "arguments": {}}})
    elif "id" in m: enviar({"jsonrpc": "2.0", "id": m["id"], "result": {}})
