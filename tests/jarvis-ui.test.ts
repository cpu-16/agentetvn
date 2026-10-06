// Jarvis-TVN · lógica pura de la interfaz: panel dentro de la pantalla, estados de la conversación y cuelgue.
import { describe, expect, test } from "bun:test";
import { acotar, clasesPanel, esCelular } from "../src/components/mesa/jarvis/panel";
import { debeColgar, estadoOrbe, siguiente, vozActiva } from "../src/components/mesa/jarvis/maquina";
describe("panel", () => {
  test("celular a 640 px o menos; en celular siempre hoja inferior", () => {
    expect(esCelular(390)).toBe(true);
    expect(esCelular(1024)).toBe(false);
    expect(clasesPanel("compacto", true)).toContain("inset-x-0");
    expect(clasesPanel("amplio", true)).toContain("100dvh");
    expect(clasesPanel("lateral", false)).toContain("bottom-4");
  });
  test("acotar deja el panel dentro de la ventana con margen", () => {
    expect(acotar({ x: 5000, y: -900 }, { w: 400, h: 600 }, { w: 1440, h: 900 })).toEqual({ x: 1440 - 400 - 16, y: 16 });
    expect(acotar({ x: 100, y: 100 }, { w: 400, h: 600 }, { w: 1440, h: 900 })).toEqual({ x: 100, y: 100 });
  });
});
describe("máquina de la voz", () => {
  test("un toque conecta y escucha; al terminar su turno piensa, luego habla y vuelve a escuchar sin tocar nada", () => {
    let e = siguiente("inactiva", { tipo: "conectar" }); expect(e).toBe("conectando"); expect(vozActiva(e)).toBe(true);
    e = siguiente(e, { tipo: "conectada" }); expect(e).toBe("escuchando");
    e = siguiente(e, { tipo: "turno_creado", rol: "user" }); expect(e).toBe("escuchando");
    e = siguiente(e, { tipo: "turno_hecho", rol: "user" }); expect(e).toBe("pensando");
    e = siguiente(e, { tipo: "turno_creado", rol: "assistant" }); expect(e).toBe("hablando");
    e = siguiente(e, { tipo: "turno_creado", rol: "user" }); expect(e).toBe("escuchando"); // la persona lo interrumpe
    e = siguiente(e, { tipo: "turno_hecho", rol: "assistant" }); expect(e).toBe("escuchando");
    expect(siguiente(e, { tipo: "colgar" })).toBe("inactiva");
    expect(vozActiva("inactiva")).toBe(false);
    expect(siguiente(e, { tipo: "fallo" })).toBe("no_disponible");
    expect(siguiente("inactiva", { tipo: "turno_hecho", rol: "user" })).toBe("inactiva"); // un evento tardío no revive la llamada
    expect(estadoOrbe("inactiva")).toBe("reposo");
    expect(estadoOrbe("conectando")).toBe("pensando");
  });
  test("cuelga con pantalla oculta, sesión vencida o un minuto sin conversación, pero no mientras Jarvis piensa o habla", () => {
    expect(debeColgar({ oculta: true, sesionVencida: false, msSinActividad: 0, enCurso: true })).toContain("pantalla");
    expect(debeColgar({ oculta: false, sesionVencida: true, msSinActividad: 0, enCurso: false })).toContain("sesión");
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 61_000, enCurso: false })).toContain("minuto");
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 25_000, enCurso: false })).toBeNull(); // 20 s ya no corta
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 30_000, enCurso: true })).toBeNull(); // pensando con la herramienta
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 46_000, enCurso: true })).toContain("respuesta"); // nunca llegó
  });
});
