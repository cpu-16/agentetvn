// Agregados del Tablero: las publicaciones por día suman lo publicado; los indicadores conservan los nulos.
import { describe, expect, test } from "bun:test";
import { agregarTablero } from "../src/lib/motor/tablero";
import type { Snapshot } from "../src/lib/motor/cargar";
import type { Evento } from "../src/lib/motor/contrato";
import { n } from "./fixtures/noticias";

const ev = (id: string, ids: string[], tema: string, extra: Partial<Evento> = {}): Evento => ({ id, representante: ids[0], ids_noticia: ids, procedencias: [{ id: "medio:TVN", tipo: "medio", nombre: "TVN", ids_noticia: ids }], tema, tema_confianza: 0.9, por_revisar: false, fecha_original: "2026-10-05T10:00:00.000Z", contexto: { indicadores: [], sismos: [] }, contradicciones: [], componentes: { R: 1, I: 0.5, U: 1, N: 1, E: 0.4, explicacion: { R: "", I: "", U: "", N: "", E: "" } }, P: 70, rango: "alto", estado_evidencia: "parcial", no_confiable: false, ...extra });

describe("tablero", () => {
  const noticias = [
    n({ id_noticia: "a", titulo: "A", url: "https://x.com/a", medio: "TVN", fecha_publicacion: "2026-10-05T10:00:00.000Z" }),
    n({ id_noticia: "b", titulo: "B", url: "https://x.com/b", medio: "prensa.com", fecha_publicacion: "2026-10-05T23:30:00.000Z" }), // 6:30 p. m. en Panamá: sigue siendo el 5
    n({ id_noticia: "c", titulo: "C", url: "https://x.com/c", medio: "TVN", fecha_publicacion: null, fecha_deteccion: "2026-10-06T03:00:00.000Z" }), // 10 p. m. del 5 en Panamá
    n({ id_noticia: "d", titulo: "D", url: "https://x.com/d", medio: "TVN", fecha_publicacion: null, fecha_deteccion: null }), // sin fecha: no cuenta en el día
  ];
  const snap = {
    manifest: { version: "v1", fecha_corte_UTC: "2026-10-06T15:00:00.000Z", sha256: {} },
    noticias,
    indicadores: [
      { pais_iso3: "PAN", indicador_id: "FP.CPI.TOTL.ZG", anio: 2023, valor: 1.5, unidad: "% anual", fuente_url: "u", fecha_extraccion: "f", licencia: "CC" },
      { pais_iso3: "PAN", indicador_id: "FP.CPI.TOTL.ZG", anio: 2024, valor: null, unidad: "% anual", fuente_url: "u", fecha_extraccion: "f", licencia: "CC" },
    ],
    sismos: [{ id: "s1", magnitude: 4.2, time: "2024-03-10T01:00:00.000Z", updated: "2024-03-10T01:00:00.000Z", longitude: -82.4, latitude: 8.4, depth: 10, place: "Chiriquí, Panama", status: "reviewed", url: "https://earthquake.usgs.gov/s1" }],
    eventos: [ev("e1", ["a", "b"], "economia"), ev("e2", ["c", "d"], "turismo", { estado_evidencia: "insuficiente" })],
    errores: [],
    fichas: [], embeddings: null, dir: "x", huella: "h", avisos: [],
  } as unknown as Snapshot;
  const t = agregarTablero(snap);

  test("porDiaTema suma las publicaciones con fecha, en hora de Panamá", () => {
    expect(t.porDiaTema.reduce((s, x) => s + x.n, 0)).toBe(3);
    expect(t.porDiaTema.find((x) => x.tema === "economia")).toEqual({ dia: "2026-10-05", tema: "economia", n: 2 });
    expect(t.porDiaTema.find((x) => x.tema === "turismo")).toEqual({ dia: "2026-10-05", tema: "turismo", n: 1 });
  });
  test("indicadores conservan nulos como huecos y cubren 2010–2024", () => {
    const inf = t.indicadores.find((i) => i.indicador_id === "FP.CPI.TOTL.ZG")!;
    const pan = inf.series.find((s) => s.pais === "PAN")!;
    expect(pan.puntos).toHaveLength(15);
    expect(pan.puntos.find((p) => p[0] === 2023)?.[1]).toBe(1.5);
    expect(pan.puntos.find((p) => p[0] === 2024)?.[1]).toBeNull();
    expect(pan.puntos.find((p) => p[0] === 2010)?.[1]).toBeNull();
  });
  test("un titular con HTML llega intacto al agregado (la UI lo escapa con esc)", async () => {
    const malo = "Titular <img src=x onerror=alert(1)> & «comillas»";
    const s2 = { ...snap, noticias: [n({ id_noticia: "z", titulo: malo, url: "https://x.com/z" })], eventos: [ev("ez", ["z"], "economia")] } as unknown as Snapshot;
    expect(agregarTablero(s2).eventos[0].titulo).toBe(malo);
    const { esc } = await import("../src/components/mesa/graficas/paleta");
    const e = esc(malo);
    expect(e).not.toContain("<");
    expect(e).not.toContain(">");
    expect(e).toContain("&lt;img");
    expect(e).toContain("&amp;");
  });
  test("medios, procedencias, evidencia, sismos y calidad", () => {
    expect(t.medios.find((m) => m.medio === "TVN")?.publicaciones).toBe(3);
    expect(t.procedencias.find((p) => p.tipo === "medio")?.n).toBe(2);
    expect(t.evidencia.find((e) => e.tema === "turismo")?.insuficiente).toBe(1);
    expect(t.sismosPorMes).toEqual([{ mes: "2024-03", n: 1, magMax: 4.2 }]);
    expect(t.calidad).toMatchObject({ noticias: 4, tvn: 3, sinFechaPublicacion: 2 });
    expect(t.eventos[0]).toMatchObject({ id: "e1", publicaciones: 2, medio: "TVN" });
  });
});
