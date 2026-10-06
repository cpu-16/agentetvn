// Filtro compartido del Tablero (a nivel de publicación): período en hora de Panamá, medio por publicación, mediana real.
import { describe, expect, test } from "bun:test";
import { filtrarDatos, mediana, diaPanama, mesPanama, type EventoTablero } from "../src/lib/motor/tablero-filtro";
import { porcentajes } from "../src/components/mesa/graficas/EvidenciaPorTema";

const ev = (id: string, tema: string, P: number, pubs: { dia: string | null; medio: string; agencia?: string | null }[], extra: Partial<EventoTablero> = {}): EventoTablero => ({
  id, titulo: id, tema, P, rango: P >= 70 ? "alto" : P >= 40 ? "medio" : "bajo", R: 1, I: 0.5, U: 1, N: 1, E: 0.4, estado_evidencia: "parcial",
  publicaciones: pubs.length, procedencias: 1, fecha: null, medio: pubs[0]?.medio ?? "", sintetica: false, no_confiable: false, por_revisar: false,
  pubs: pubs.map((p) => ({ dia: p.dia, medio: p.medio, agencia: p.agencia ?? null })), dias: [...new Set(pubs.map((p) => p.dia).filter((d): d is string => !!d))].sort(),
  procTipos: { agencia: 0, medio: 1, primaria: 0, no_verificada: 0 }, ...extra,
});

describe("filtro del tablero", () => {
  const eventos = [
    ev("a", "economia", 80, [{ dia: "2026-10-05", medio: "TVN" }, { dia: "2026-10-06", medio: "prensa.com", agencia: "EFE" }]),
    ev("b", "economia", 60, [{ dia: "2026-10-03", medio: "prensa.com" }]),
    ev("c", "turismo", 90, [{ dia: null, medio: "TVN" }]),
    ev("d", "turismo", 50, [{ dia: "2026-10-06", medio: "critica.com.pa" }]),
  ];
  test("sin filtro: todo cuenta; las publicaciones sin fecha cuentan en el total pero no en la serie por día", () => {
    const a = filtrarDatos(eventos, { temas: [], rango: [] });
    expect(a.eventos).toHaveLength(4);
    expect(a.publicaciones).toBe(5);
    expect(a.porDiaTema.reduce((s, x) => s + x.n, 0)).toBe(4);
    expect(a.mediosDistintos).toBe(4); // TVN, agencia:EFE, prensa.com, critica.com.pa
  });
  test("período: un evento queda si ALGUNA publicación cae en el período y solo se cuentan esas publicaciones", () => {
    const a = filtrarDatos(eventos, { temas: [], rango: [], desde: "2026-10-06", hasta: "2026-10-06" });
    expect(a.eventos.map((e) => e.id).sort()).toEqual(["a", "d"]);
    expect(a.publicaciones).toBe(2);
    expect(a.porDiaTema).toEqual([{ dia: "2026-10-06", tema: "economia", n: 1 }, { dia: "2026-10-06", tema: "turismo", n: 1 }]);
  });
  test("medio: cuenta publicaciones de ese medio dentro de cada evento, no solo el representante", () => {
    const a = filtrarDatos(eventos, { temas: [], rango: [], medio: "prensa.com" });
    expect(a.eventos.map((e) => e.id).sort()).toEqual(["a", "b"]);
    expect(a.publicaciones).toBe(2);
    // la gráfica de medios sigue mostrando las alternativas del conjunto (sin el filtro de medio)
    expect(a.medios.map((m) => m.medio).sort()).toEqual(["TVN", "prensa.com"]);
    expect(a.medios.find((m) => m.medio === "prensa.com")).toMatchObject({ publicaciones: 2, eventos: 2, agencia: true });
  });
  test("tema y rango se combinan con el resto", () => {
    const a = filtrarDatos(eventos, { temas: ["turismo"], rango: ["alto"] });
    expect(a.eventos.map((e) => e.id)).toEqual(["c"]);
    expect(a.evidencia).toEqual([{ tema: "turismo", insuficiente: 0, parcial: 1, suficiente: 0 }]);
  });
  test("mediana real con n par y P mediana por tema", () => {
    expect(mediana([10, 90])).toBe(50);
    expect(mediana([1, 2, 3])).toBe(2);
    expect(mediana([])).toBe(0);
    expect(filtrarDatos(eventos, { temas: ["economia"], rango: [] }).temas[0].P_mediana).toBe(70);
  });
  test("día y mes en hora de Panamá: las 02:00Z son el día anterior", () => {
    expect(diaPanama("2026-10-06T02:00:00.000Z")).toBe("2026-10-05");
    expect(mesPanama("2024-03-01T03:00:00.000Z")).toBe("2024-02");
  });
  test("porcentajes de barras al 100 % cierran exactamente en 100", () => {
    const p = porcentajes([1, 1, 4]);
    expect(p.reduce((s, x) => s + x, 0)).toBe(100);
    expect(porcentajes([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
