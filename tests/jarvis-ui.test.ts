// Jarvis-TVN · lógica pura de la interfaz: toque vs. mantener, panel dentro de la pantalla, estados y cuelgue.
import { describe, expect, test } from "bun:test";
import { clasificarPulsacion } from "../src/components/mesa/jarvis/pulsacion";
import { acotar, clasesPanel, esCelular } from "../src/components/mesa/jarvis/panel";
import { debeColgar, estadoOrbe, siguiente } from "../src/components/mesa/jarvis/maquina";

describe("pulsación", () => {
  test("toque corto abre el panel; sostenida habla", () => {
    expect(clasificarPulsacion(120)).toBe("toque");
    expect(clasificarPulsacion(400)).toBe("sostenida");
  });
});
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
  test("pulsar escucha, soltar piensa hasta que la voz empieza a hablar, y al terminar queda lista", () => {
    let e = siguiente("inactiva", { tipo: "conectar" });
    e = siguiente(e, { tipo: "conectada" }); expect(e).toBe("lista");
    e = siguiente(e, { tipo: "pulsar" }); expect(e).toBe("escuchando");
    e = siguiente(e, { tipo: "soltar" }); expect(e).toBe("pensando");
    e = siguiente(e, { tipo: "turno_creado", rol: "assistant" }); expect(e).toBe("hablando");
    e = siguiente(e, { tipo: "turno_hecho", rol: "assistant" }); expect(e).toBe("lista");
    expect(siguiente(e, { tipo: "fallo" })).toBe("no_disponible");
    expect(estadoOrbe("lista")).toBe("reposo");
    expect(estadoOrbe("conectando")).toBe("pensando");
  });
  test("cuelga con pantalla oculta, sesión vencida o 20 s sin actividad, pero no mientras algo está en curso", () => {
    expect(debeColgar({ oculta: true, sesionVencida: false, msSinActividad: 0, enCurso: true })).toContain("pantalla");
    expect(debeColgar({ oculta: false, sesionVencida: true, msSinActividad: 0, enCurso: false })).toContain("sesión");
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 21_000, enCurso: false })).toContain("silencio");
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 60_000, enCurso: true })).toBeNull();
    expect(debeColgar({ oculta: false, sesionVencida: false, msSinActividad: 5_000, enCurso: false })).toBeNull();
  });
});
