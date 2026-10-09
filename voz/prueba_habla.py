#!/usr/bin/env python3
"""Prueba sin red de la voz literal (clientManagedHandoffs): qué dice la voz en cada turno del cerebro.
Uso: python3 voz/prueba_habla.py"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.argv = ["x"]
import puente as P

dichos = []
P.rpc = lambda m, params=None, wait=True, timeout=60: dichos.append(params["text"]) if m == "thread/realtime/appendSpeech" else None
TEXTOS = {"a": "Texto A.", "b": "Parte uno.", "c": "Parte dos.", "d": "Interrumpido.", "e": "Sin cierre."}
P.a_next = lambda ruta, cuerpo=None, timeout=60: (200, {"texto": TEXTOS[cuerpo["args"]["k"]]})
P.app = type("App", (), {"stdin": type("S", (), {"write": lambda self, s: None, "flush": lambda self: None})()})()
P.estado["activa"] = {"hilo": "H", "inicio": time.time(), "limite": 300, "persona": "t", "tokens": 0, "herramientas": []}

def tool(turno, k): P.herramienta(1, {"tool": "preguntar_corpus", "arguments": {"k": k}, "threadId": "H", "turnId": turno})
def fin(turno, st):
    with P.lock: P.turno_de(P.estado["activa"], turno)["cerrado"] = st
    P.hablar("H", turno)

tool("t1", "a"); fin("t1", "completed")                       # normal: el texto exacto de la herramienta
tool("t2", "b"); tool("t2", "c"); fin("t2", "completed")      # dos herramientas en un turno (recorrido «seguido»): se dicen las dos
tool("t3", "d"); fin("t3", "interrupted")                     # interrumpido: no se dice nada
P.plan_b.__defaults__ = (0.5,); tool("t4", "e"); time.sleep(1.2)  # sin turn/completed: plan B
fin("t1", "completed")                                        # cierre repetido: no repite
fin("t6", "completed")                                        # turno sin herramientas: frase fija, nunca la del cerebro
time.sleep(0.3)
assert dichos == ["Texto A.", "Parte uno. Parte dos.", "Sin cierre.", P.NO_LLEGO], dichos
print("prueba_habla: OK")
