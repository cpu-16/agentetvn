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
