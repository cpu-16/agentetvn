// La mesa de cada rol: el mismo filtro para la portada, el chat y Jarvis (reto §2: cada usuario recibe un trabajo distinto).
import { describe, expect, test } from "bun:test";
import { cuentasMesa, tocaA, type EventoMesa } from "../src/lib/roles";

const ev = (id: string, P: number, estado_evidencia: string, estado_revision = "nuevo", extra: Partial<EventoMesa> = {}): EventoMesa =>
  ({ id, titulo: id, P, rango: P >= 70 ? "alto" : "medio", estado_evidencia, estado_revision, contradicciones: [], no_confiable: false, ...extra });
const corte = [
  ev("a", 90, "insuficiente"), ev("b", 80, "suficiente"), ev("c", 70, "parcial", "en_revision"), ev("d", 60, "suficiente", "aprobado_borrador"),
  ev("e", 50, "parcial", "requiere_evidencia"), ev("f", 95, "suficiente", "descartado"), ev("g", 99, "suficiente", "nuevo", { sintetica: true }), ev("h", 85, "suficiente", "nuevo", { contradicciones: [{}] }),
];

describe("mesa por rol", () => {
  test("editor: primero lo que espera su aprobación; nada descartado, aprobado ni sintético", () => {
    expect(tocaA("editor", corte).map((e) => e.id)).toEqual(["c", "a", "h", "b"]);
  });
  test("periodista: primero lo que el editor devolvió; solo lo que tiene algo que verificar", () => {
    expect(tocaA("periodista", corte).map((e) => e.id)).toEqual(["e", "c", "a", "h"]);
  });
  test("productor: primero lo aprobado para adaptar; nunca sin evidencia ni con versiones en disputa", () => {
    expect(tocaA("productor", corte).map((e) => e.id)).toEqual(["d", "c", "b"]);
  });
  test("las cifras de la mesa no cuentan casos sintéticos", () => {
    expect(cuentasMesa("editor", corte)[0]).toEqual({ n: 3, etiqueta: "de prioridad alta sin decidir" });
  });
});
