import { describe, expect, test } from "bun:test";
import { buscarBM25, indexarBM25, jaccard, tokenizar } from "../src/lib/motor/bm25";
import { coseno, embeber, modeloDisponible } from "../src/lib/motor/embeddings";

describe("baseline BM25", () => {
  test("tokeniza sin tildes ni stopwords", () => {
    expect(tokenizar("La inflación de Panamá")).toEqual(["inflacion", "panama"]);
  });
  test("encuentra el documento con el término", () => {
    const idx = indexarBM25([
      { id: "a", texto: "Sismo de 4.2 sacude Chiriquí" },
      { id: "b", texto: "Panamá crece 2.8 % según el Banco Mundial" },
    ]);
    expect(buscarBM25(idx, "sismo en Chiriquí")[0].id).toBe("a");
    expect(buscarBM25(idx, "zzz")).toHaveLength(0);
  });
  test("jaccard de titulares casi idénticos", () => {
    expect(jaccard("Sismo de 4.2 sacude Chiriquí", "Sismo de 4.2 sacude Chiriquí sin daños")).toBeGreaterThan(0.7);
    expect(jaccard("Sismo en Chiriquí", "Inflación en Panamá")).toBeLessThan(0.2);
  });
});

describe("embeddings locales", () => {
  test("vectores normalizados y coseno discriminante", async () => {
    if (!(await modeloDisponible())) {
      console.warn("modelo no disponible en caché: prueba saltada (modo léxico)");
      return;
    }
    const [q, a, b] = await embeber(["sismo en Chiriquí", "Sismo de 4.2 sacude Chiriquí sin daños", "Panamá crece 2.8 % en 2024"], "query");
    expect(coseno(q, q)).toBeCloseTo(1, 3);
    expect(coseno(q, a)).toBeGreaterThan(coseno(q, b));
  }, 120000);
});

describe("traza de la búsqueda (lo que dibuja el chat)", () => {
  test("histograma: cuenta todo, cubre del mínimo al máximo", async () => {
    const { histograma } = await import("../src/lib/motor/consulta");
    const h = histograma([0.71, 0.72, 0.8, 0.95, 0.95], 10)!;
    expect(h.cuentas.reduce((a, b) => a + b, 0)).toBe(5);
    expect(h.desde).toBeLessThanOrEqual(0.71);
    expect(h.hasta).toBeGreaterThanOrEqual(0.95);
    expect(histograma([])).toBeUndefined();
  });
  test("por palabras: la traza marca usadas las mismas que van a las evidencias", async () => {
    const { consultar } = await import("../src/lib/motor/consulta");
    const { snapshot } = await import("../src/lib/motor/servicio");
    const r = await consultar("Canal de Panamá", snapshot(), { modo: "bm25" });
    expect(r.traza?.modo).toBe("bm25");
    expect(r.traza!.comparadas).toBeGreaterThan(100);
    expect(r.traza!.mejores.filter((m) => m.usada).map((m) => m.id)).toEqual(r.evidencias.map((e) => e.id));
  });
});
