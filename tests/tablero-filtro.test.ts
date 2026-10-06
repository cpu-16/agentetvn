// Filtro compartido del Tablero (a nivel de publicación): período en hora de Panamá, medio por publicación, mediana real.
import { describe, expect, test } from "bun:test";
import { filtrarDatos, mediana, diaPanama, mesPanama, type EventoTablero } from "../src/lib/motor/tablero-filtro";
import { porcentajes } from "../src/components/mesa/graficas/EvidenciaPorTema";

const ev = (id: string, tema: string, P: number, pubs: { dia: string | null; medio: string; agencia?: string | null; proc?: string; procTipo?: "agencia" | "medio" | "primaria" | "no_verificada" }[], extra: Partial<EventoTablero> = {}): EventoTablero => ({
  id, titulo: id, tema, P, rango: P >= 70 ? "alto" : P >= 40 ? "medio" : "bajo", R: 1, I: 0.5, U: 1, N: 1, E: 0.4, estado_evidencia: "parcial",
  publicaciones: pubs.length, procedencias: 1, fecha: null, medio: pubs[0]?.medio ?? "", sintetica: false, no_confiable: false, por_revisar: false,
  pubs: pubs.map((p) => ({ dia: p.dia, medio: p.medio, agencia: p.agencia ?? null, proc: p.proc ?? (p.agencia ? `agencia:${p.agencia}` : `medio:${p.medio}`), procTipo: p.procTipo ?? (p.agencia ? "agencia" : "medio"), deteccion: p.dia === null })), dias: [...new Set(pubs.map((p) => p.dia).filter((d): d is string => !!d))].sort(),
  ...extra,
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
    expect(a.mediosDistintos).toBe(3); // TVN, prensa.com, critica.com.pa: se cuentan medios; la agencia va aparte
    expect(a.agenciasDistintas).toBe(1); // EFE
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
    // la gráfica de medios muestra TODAS las alternativas de tema/rango/período, no solo las de los eventos de ese medio
    expect(a.medios.map((m) => m.medio).sort()).toEqual(["TVN", "critica.com.pa", "prensa.com"]);
    expect(a.medios.find((m) => m.medio === "prensa.com")).toMatchObject({ publicaciones: 2, eventos: 2, agencia: true });
  });
  test("con filtro, cada evento cuenta solo sus publicaciones filtradas (mapa y dispersión suman lo mismo que la tarjeta)", () => {
    const a = filtrarDatos(eventos, { temas: [], rango: [], medio: "TVN" });
    expect(a.publicaciones).toBe(2);
    expect(a.eventos.reduce((s, e) => s + e.publicaciones, 0)).toBe(2); // el evento «a» tiene 2 publicaciones, pero solo 1 es de TVN
    expect(a.temas.reduce((s, t) => s + t.publicaciones, 0)).toBe(2);
    expect(eventos.find((e) => e.id === "a")!.publicaciones).toBe(2); // no muta la entrada
  });
  test("procedencias: solo las de las publicaciones filtradas, una vez por evento", () => {
    const evs = [
      ev("x", "economia", 80, [{ dia: "2026-10-05", medio: "TVN" }, { dia: "2026-10-05", medio: "m1", agencia: "EFE" }, { dia: "2026-10-05", medio: "m2", agencia: "EFE" }]),
      ev("y", "economia", 70, [{ dia: "2026-10-05", medio: "TVN" }]),
    ];
    const todo = filtrarDatos(evs, { temas: [], rango: [] });
    expect(todo.procedencias.find((p) => p.tipo === "agencia")!.n).toBe(1); // dos réplicas de EFE en un evento = una
    expect(todo.procedencias.find((p) => p.tipo === "medio")!.n).toBe(2); // TVN en x y TVN en y: acumuladas por evento
    const tvn = filtrarDatos(evs, { temas: [], rango: [], medio: "TVN" });
    expect(tvn.procedencias.find((p) => p.tipo === "agencia")!.n).toBe(0); // la agencia del evento x no es de TVN
    expect(tvn.procedencias.find((p) => p.tipo === "medio")!.n).toBe(2);
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
