import { expect, test } from "bun:test";
import { nombreMedio } from "../src/lib/medios";

test("nombres editoriales de los medios del corpus", () => {
  expect(nombreMedio("critica.com.pa")).toBe("Crítica");
  expect(nombreMedio("prensa.com")).toBe("La Prensa");
  expect(nombreMedio("panamaamerica.com.pa")).toBe("Panamá América");
  expect(nombreMedio("TVN")).toBe("TVN");
});

test("sin alias devuelve exactamente el valor original", () => {
  expect(nombreMedio("desconocido.test")).toBe("desconocido.test");
  expect(nombreMedio("Medio local")).toBe("Medio local");
  expect(nombreMedio("toString")).toBe("toString");
});
