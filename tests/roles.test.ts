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
  test("periodista: primero lo que el editor le pidió; solo lo que tiene algo que verificar; lo que ya devolvió sale", () => {
    expect(tocaA("periodista", corte).map((e) => e.id)).toEqual(["e", "a", "h"]);
  });
  test("productor: primero lo aprobado para adaptar; nunca sin evidencia ni con versiones en disputa", () => {
    expect(tocaA("productor", corte).map((e) => e.id)).toEqual(["d", "c", "b"]);
  });
  test("productor: la pieza lista sale de su cola y se cuenta aparte", () => {
    const conPieza = [...corte, ev("i", 88, "suficiente", "pieza_lista")];
    expect(tocaA("productor", conPieza).map((e) => e.id)).toEqual(["d", "c", "b"]);
    expect(cuentasMesa("productor", conPieza)[2]).toEqual({ n: 1, etiqueta: "piezas listas" });
  });
  test("analista bancario: solo temas económicos, por puntaje, nunca descartados ni sintéticos", () => {
    const eco = [ev("x", 60, "parcial", "nuevo", { tema: "economia" }), ev("y", 90, "insuficiente", "aprobado_borrador", { tema: "logistica_canal" }),
      ev("z", 99, "suficiente", "nuevo", { tema: "deportes" }), ev("w", 95, "suficiente", "descartado", { tema: "economia" }), ev("v", 97, "suficiente", "nuevo", { tema: "regulacion", sintetica: true }), ev("u", 98, "suficiente", "nuevo", { tema: "logistica_canal", por_revisar: true })];
    expect(tocaA("analista", eco).map((e) => e.id)).toEqual(["y", "x"]);
    expect(cuentasMesa("analista", eco).map((c) => c.n)).toEqual([3, 2, 1]);
  });
  test("las cifras de la mesa no cuentan casos sintéticos", () => {
    expect(cuentasMesa("editor", corte)[0]).toEqual({ n: 3, etiqueta: "de prioridad alta sin decidir" });
  });
});
