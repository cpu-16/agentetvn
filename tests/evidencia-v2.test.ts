// Regla de evidencia v2 (D20): qué permite sostener el material, no si la noticia es verdadera.
import { describe, expect, test } from "bun:test";
import { aportaExtracto, conEvidenciaVigente, esPlantillaEvidencia, estadoEvidencia, faltaPorEvidencia } from "../src/lib/motor/evidencia";
import type { Contradiccion, Procedencia } from "../src/lib/motor/contrato";

const medio = (nombre: string, ids = [nombre]): Procedencia => ({ id: `medio:${nombre}`, tipo: "medio", nombre, ids_noticia: ids });
const copia = (ids: string[]): Procedencia => ({ id: "no_verificada", tipo: "no_verificada", nombre: "independencia no verificada", ids_noticia: ids });
const disputa: Contradiccion[] = [{ a: "a", b: "b", campo: "titulo", detalle: "«3 muertos» vs «5 muertos»" }];

describe("estado de evidencia v2", () => {
  test("fuente primaria del hecho → suficiente para el borrador, sin pendiente de evidencia", () => {
    expect(estadoEvidencia(0.82, [medio("TVN")], true, [], true)).toBe("suficiente");
    expect(faltaPorEvidencia({ estado_evidencia: "suficiente", procedencias: [medio("TVN")], contradicciones: [], primaria: true })).toEqual([]);
  });
  test("dos procedencias independientes con URL y fecha → suficiente, con el aviso de confirmar que no son el mismo cable", () => {
    const pr = [medio("prensa.com"), medio("telemetro.com")];
    expect(estadoEvidencia(0.55, pr, false, [], false)).toBe("suficiente");
    expect(faltaPorEvidencia({ estado_evidencia: "suficiente", procedencias: pr, contradicciones: [], primaria: false })[0]).toContain("mismo cable");
  });
  test("dos procedencias pero alguna sin URL o fecha (E bajo umbral) → parcial", () => {
    expect(estadoEvidencia(0.35, [medio("a.com"), medio("b.com")], false, [], false)).toBe("parcial");
  });
  test("cobertura propia con extracto (una procedencia) → parcial, atribuida a esa procedencia", () => {
    expect(estadoEvidencia(0.375, [medio("TVN")], false, [], true)).toBe("parcial");
    const f = faltaPorEvidencia({ estado_evidencia: "parcial", procedencias: [medio("TVN")], contradicciones: [], primaria: false });
    expect(f[0]).toContain("solo TVN, con extracto");
  });
  test("solo el titular de una procedencia → insuficiente, y dice qué conseguir", () => {
    expect(estadoEvidencia(0.375, [medio("critica.com.pa")], false, [], false)).toBe("insuficiente");
    const f = faltaPorEvidencia({ estado_evidencia: "insuficiente", procedencias: [medio("critica.com.pa")], contradicciones: [], primaria: false });
    expect(f[0]).toContain("solo el titular de critica.com.pa");
    expect(f[0]).toContain("otra fuente independiente o la primaria");
  });
  test("titulares copiados sin agencia no cuentan, aunque traigan extracto → insuficiente", () => {
    expect(estadoEvidencia(0.2, [copia(["a", "b", "c"])], false, [], true)).toBe("insuficiente");
  });
  test("CU-03: cinco medios con el mismo despacho de EFE son una procedencia → parcial, nunca suficiente", () => {
    const efe: Procedencia = { id: "agencia:EFE", tipo: "agencia", nombre: "EFE", ids_noticia: ["a", "b", "c", "d", "e"] };
    expect(estadoEvidencia(0.375, [efe], false, [], true)).toBe("parcial");
    expect(estadoEvidencia(0.375, [efe], false, [], false)).toBe("insuficiente");
  });
  test("versiones en disputa: con respaldo → parcial; sin respaldo → insuficiente; nunca suficiente", () => {
    expect(estadoEvidencia(0.9, [medio("a.com"), medio("b.com")], true, disputa, true)).toBe("parcial");
    expect(estadoEvidencia(0.375, [medio("a.com", ["a", "b"])], false, disputa, true)).toBe("insuficiente");
  });
});

describe("extracto que aporta", () => {
  test("una bajada que solo repite el titular con autor y fecha no cuenta como extracto", () => {
    const tit = "Mulino refuerza alianza marítima con Vietnam y anuncia oficina de Panamá";
    expect(aportaExtracto(tit, `${tit} \nmmontenegro\nMar, 06/10/2026 - 06:35`)).toBe(false);
  });
  test("una bajada con información nueva sí cuenta", () => {
    expect(aportaExtracto("Producto Interno Bruto de Panamá crece 6.4% en el segundo trimestre de 2026", "La economía panameña generó $20,069.2 millones entre abril y junio, un incremento interanual de $1,204.3 millones.")).toBe(true);
  });
});

describe("paquete guardado con la regla vigente", () => {
  test("reemplaza la línea de evidencia de la v1 y conserva las demás verificaciones", () => {
    const viejo = { verificaciones: ["Evidencia insuficiente: conseguir fuente primaria antes de afirmar el hecho.", "Leer la nota completa: todo lo anterior se basa únicamente en titular/metadatos."] };
    const p = conEvidenciaVigente(viejo, { estado_evidencia: "parcial", procedencias: [medio("TVN")], contradicciones: [], primaria: false });
    expect(p.verificaciones).toHaveLength(2);
    expect(p.verificaciones[0]).toContain("solo TVN, con extracto");
    expect(p.verificaciones[1]).toStartWith("Leer la nota completa");
  });
  test("una verificación escrita por una persona se conserva aunque empiece con «Evidencia parcial:»", () => {
    const humana = "Evidencia parcial: llamar al hospital para confirmar los fallecidos.";
    const p = conEvidenciaVigente({ verificaciones: [humana] }, { estado_evidencia: "suficiente", procedencias: [medio("TVN")], contradicciones: [], primaria: true });
    expect(p.verificaciones).toEqual([humana]);
  });
  test("toda línea que genera el motor es reconocida como plantilla (si no, se duplicaría al servir)", () => {
    const casos = [
      { estado_evidencia: "insuficiente" as const, procedencias: [medio("critica.com.pa")], contradicciones: [], primaria: false },
      { estado_evidencia: "insuficiente" as const, procedencias: [copia(["a", "b"])], contradicciones: [], primaria: false },
      { estado_evidencia: "insuficiente" as const, procedencias: [medio("a.com", ["a", "b"])], contradicciones: disputa, primaria: false },
      { estado_evidencia: "parcial" as const, procedencias: [medio("a.com"), medio("b.com")], contradicciones: disputa, primaria: false },
      { estado_evidencia: "parcial" as const, procedencias: [medio("TVN")], contradicciones: [], primaria: false },
      { estado_evidencia: "parcial" as const, procedencias: [medio("a.com"), medio("b.com")], contradicciones: [], primaria: false },
      { estado_evidencia: "suficiente" as const, procedencias: [medio("prensa.com"), medio("telemetro.com")], contradicciones: [], primaria: false },
    ];
    for (const c of casos) for (const linea of faltaPorEvidencia(c)) {
      expect(esPlantillaEvidencia(linea)).toBe(true);
      expect(linea.split(/\s+/).length).toBeLessThanOrEqual(14); // el boletín bancario corta en 14 palabras
    }
  });
  test("primaria sin URL o fecha identificable no llega a verde", () => {
    expect(estadoEvidencia(0.45, [], true, [], false, undefined, false)).toBe("parcial");
  });
  test("con fuente primaria y sin disputa no deja línea de evidencia", () => {
    const p = conEvidenciaVigente({ verificaciones: ["Evidencia parcial: conseguir fuente primaria antes de afirmar el hecho.", "Otra."] }, { estado_evidencia: "suficiente", procedencias: [medio("TVN")], contradicciones: [], primaria: true });
    expect(p.verificaciones).toEqual(["Otra."]);
  });
});
