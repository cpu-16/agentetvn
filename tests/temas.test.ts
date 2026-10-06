import { describe, expect, test } from "bun:test";
import { clasificarTema, temaPorPalabras } from "../src/lib/motor/temas";

describe("temas", () => {
  test("baseline por palabras", () => {
    expect(temaPorPalabras("Sismo de 4.5 sacude Chiriquí")).toBe("eventos_naturales");
    expect(temaPorPalabras("Canal de Panamá registra récord de tránsito de buques")).toBe("logistica_canal");
    expect(temaPorPalabras("Gana el equipo local")).toBeNull();
  });
  test("zero-shot marca por revisar cuando el margen es chico", () => {
    const temas = [{ id: "a", vec: [1, 0] }, { id: "b", vec: [0, 1] }];
    expect(clasificarTema([0.9, 0.1], temas, { umbral: 0.5, margen: 0.1 })).toMatchObject({ tema: "a", por_revisar: false });
    expect(clasificarTema([0.7, 0.68], temas, { umbral: 0.5, margen: 0.1 }).por_revisar).toBe(true);
  });
});
