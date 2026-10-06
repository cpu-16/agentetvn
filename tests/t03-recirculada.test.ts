// T03 · Noticia antigua recirculada: mostrar la fecha original; no presentarla como evento nuevo.
import { describe, expect, test } from "bun:test";
import { agruparEventos } from "../src/lib/motor/eventos";
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
});
