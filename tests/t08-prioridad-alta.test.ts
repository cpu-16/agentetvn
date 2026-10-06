// T08 · Caso de prioridad alta: exponer componentes y regla; la prioridad no habilita publicación.
import { describe, expect, test } from "bun:test";
import { ordenar, puntuar } from "../src/lib/motor/puntaje";
import { estadoEvidencia } from "../src/lib/motor/evidencia";
import { n } from "./fixtures/noticias";

describe("T08 prioridad alta", () => {
  const corte = "2026-10-06T12:00:00.000Z";
  test("evento reciente, de agenda, con agencia → P alto con los 5 componentes explicados; evidencia aparte", () => {
    const pubs = [n({ id_noticia: "a", titulo: "Canal de Panamá anuncia aumento de peajes desde enero", medio: "TVN", origen: "tvn_rss", fecha_publicacion: "2026-10-06T08:00:00.000Z" })];
    const r = puntuar({ publicaciones: pubs, procedencias: [{ id: "medio:TVN", tipo: "medio", nombre: "TVN", ids_noticia: ["a"] }], tema: "logistica_canal", por_revisar: false, contexto: { indicadores: [], sismos: [] }, contradicciones: [], novedad: "primera", fecha_original: pubs[0].fecha_publicacion, corteUTC: corte, indicadores: [], sismos: [] });
    expect(r.P).toBeGreaterThanOrEqual(70);
    expect(r.rango).toBe("alto");
    for (const k of ["R", "I", "U", "N", "E"] as const) {
      expect(r[k]).toBeGreaterThanOrEqual(0);
      expect(r[k]).toBeLessThanOrEqual(1);
      expect(r.explicacion[k].length).toBeGreaterThan(5);
    }
    // alto en P pero sin fuente primaria y una sola procedencia → evidencia insuficiente
    expect(estadoEvidencia(r.E, [{ id: "medio:TVN", tipo: "medio", nombre: "TVN", ids_noticia: ["a"] }], r.primaria, [], true)).toBe("insuficiente");
  });
  test("deportes queda fuera de la agenda (R sin tema) y GDELT sin fecha tiene U baja", () => {
    const r = puntuar({ publicaciones: [n({ titulo: "Panamá gana 2-0 a Honduras en la eliminatoria", fecha_publicacion: null, fecha_deteccion: "2026-10-06T08:00:00.000Z" })], procedencias: [], tema: "deportes", por_revisar: false, contexto: { indicadores: [], sismos: [] }, contradicciones: [], novedad: "primera", fecha_original: null, corteUTC: corte, indicadores: [], sismos: [] });
    expect(r.R).toBeLessThanOrEqual(0.45);
    expect(r.U).toBe(0.2);
    expect(r.explicacion.U).toContain("detección");
  });
  test("orden: P desc, U desc, id asc", () => {
    const o = ordenar([{ id: "b", P: 50, componentes: { U: 1 } }, { id: "a", P: 50, componentes: { U: 1 } }, { id: "c", P: 80, componentes: { U: 0 } }, { id: "d", P: 50, componentes: { U: 0.4 } }]);
    expect(o.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });
});
