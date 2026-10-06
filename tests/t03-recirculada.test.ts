// T03 · Noticia antigua recirculada: mostrar la fecha original; no presentarla como evento nuevo.
import { describe, expect, test } from "bun:test";
import { agruparEventos } from "../src/lib/motor/eventos";
import { componenteU } from "../src/lib/motor/puntaje";
import { leerScoring } from "../src/lib/motor/config";
import { n } from "./fixtures/noticias";

describe("T03 recirculada", () => {
  test("la fecha original del evento es la mínima publicación; la detección de GDELT no cuenta", () => {
    const vieja = n({ id_noticia: "v", titulo: "Gobierno anuncia plan de agua para Panamá Oeste", url: "https://m1.com/v", fecha_publicacion: "2026-07-01T12:00:00.000Z" });
    const nueva = n({ id_noticia: "r", titulo: "Gobierno anuncia plan de agua para Panamá Oeste", url: "https://m2.com/r", fecha_publicacion: null, fecha_deteccion: "2026-10-05T08:00:00.000Z" });
    const ev = agruparEventos([nueva, vieja], new Map());
    expect(ev).toHaveLength(1);
    expect(ev[0].fecha_original).toBe("2026-07-01T12:00:00.000Z");
    expect(ev[0].representante).toBe("v");
  });
  test("la urgencia se calcula con la fecha original: una copia de hoy no rejuvenece", () => {
    const cfg = leerScoring().U;
    const vieja = n({ id_noticia: "v", titulo: "x", fecha_publicacion: "2026-09-30T12:00:00.000Z" });
    const copia = n({ id_noticia: "c", titulo: "x", url: "https://m2.com/c", fecha_publicacion: "2026-10-06T08:00:00.000Z" });
    expect(componenteU([vieja], "2026-10-06T12:00:00.000Z", cfg).v).toBe(componenteU([vieja, copia], "2026-10-06T12:00:00.000Z", cfg).v);
    expect(componenteU([n({ fecha_publicacion: "2030-01-01T00:00:00.000Z" })], "2026-10-06T12:00:00.000Z", cfg).v).toBe(0);
  });
});
