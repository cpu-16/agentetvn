// Regresión sobre el snapshot v1 real con los números recalculados por fuera (revisión de Codex del 6-oct, sin sintéticos):
// TVN 85 publicaciones y 74 procedencias; regulación el 1-oct: 7; con TVN elegido, prensa.com sigue en 75 entre las alternativas.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { eventosTablero, filtrarDatos, resumenCorte } from "../src/lib/motor/tablero";

const CORTE_V1 = "2026-10-06T16:39:20.671Z";
const esV1 = JSON.parse(readFileSync("data/processed/manifest.json", "utf8")).fecha_corte_UTC === CORTE_V1;

describe.skipIf(!esV1)("tablero sobre el snapshot v1", () => {
  const snap = cargarSnapshot("data/processed", { forzar: true });
  const evs = eventosTablero(snap);
  test("sin sintéticos ni no confiables: 1 071 publicaciones, 774 eventos, 286 medios, 1 agencia", () => {
    expect(resumenCorte(snap)).toEqual({ publicaciones: 1071, eventos: 774, medios: 286, agencias: 1, sinteticas: 8, noConfiablesReales: 0 });
  });
  test("filtro TVN: 85 publicaciones, 74 procedencias, y la suma por evento coincide", () => {
    const a = filtrarDatos(evs, { temas: [], rango: [], medio: "TVN" });
    expect(a.publicaciones).toBe(85);
    expect(a.procedencias.reduce((s, p) => s + p.n, 0)).toBe(74);
    expect(a.eventos.reduce((s, e) => s + e.publicaciones, 0)).toBe(85);
    expect(a.medios.find((m) => m.medio === "prensa.com")?.publicaciones).toBe(75); // alternativas sin el filtro de medio
    expect(a.porDeteccion).toBe(0); // TVN trae fecha de publicación: la nota de la serie no debe hablar de detección
    expect(filtrarDatos(evs, { temas: [], rango: [] }).porDeteccion).toBe(977);
  });
  test("regulación el 1-oct: 7 publicaciones también en el mapa", () => {
    const a = filtrarDatos(evs, { temas: ["regulacion"], rango: [], desde: "2026-10-01", hasta: "2026-10-01" });
    expect(a.publicaciones).toBe(7);
    expect(a.temas.find((t) => t.tema === "regulacion")?.publicaciones).toBe(7);
    expect(a.eventos.reduce((s, e) => s + e.publicaciones, 0)).toBe(7);
  });
});
