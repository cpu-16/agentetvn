// T05 · Dos afirmaciones incompatibles: mostrar ambas, su alcance y la revisión pendiente; no escoger arbitrariamente.
import { describe, expect, test } from "bun:test";
import { detectarContradicciones, estadoEvidencia } from "../src/lib/motor/evidencia";
import { agruparEventos } from "../src/lib/motor/eventos";
import { n } from "./fixtures/noticias";

describe("T05 contradicción", () => {
  test("cifras distintas con la misma unidad → contradicción con ambas versiones y estado no suficiente", () => {
    const a = n({ id_noticia: "a", titulo: "Deslizamiento deja 3 muertos en Colón", medio: "m1.com" });
    const b = n({ id_noticia: "b", titulo: "Suben a 5 muertos por deslizamiento en Colón", medio: "m2.com" });
    const c = detectarContradicciones([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].detalle).toContain("3 muertos");
    expect(c[0].detalle).toContain("5 muertos");
    const estado = estadoEvidencia(0.8, [{ id: "medio:m1.com", tipo: "medio", nombre: "m1", ids_noticia: ["a"] }, { id: "medio:m2.com", tipo: "medio", nombre: "m2", ids_noticia: ["b"] }], true, c, true);
    expect(estado).not.toBe("suficiente");
  });
  test("cadena completa sin embeddings: las dos versiones se agrupan en un evento y la contradicción aparece", () => {
    const a = n({ id_noticia: "a", titulo: "Deslizamiento deja 3 muertos en Colón", medio: "m1.com", url: "https://m1.com/a", fecha_publicacion: "2026-10-03T09:00:00.000Z" });
    const b = n({ id_noticia: "b", titulo: "Suben a 5 muertos por deslizamiento en Colón", medio: "m2.com", url: "https://m2.com/b", fecha_publicacion: "2026-10-03T11:00:00.000Z" });
    const ev = agruparEventos([a, b], new Map());
    expect(ev).toHaveLength(1);
    expect(detectarContradicciones([a, b])).toHaveLength(1);
  });
  test("dos copias idénticas con dos cifras internas no generan contradicción falsa; se conserva el campo de cada cifra", () => {
    const t = "Panamá registra 3 muertos y 5 muertos en dos incidentes distintos";
    expect(detectarContradicciones([n({ id_noticia: "a", titulo: t }), n({ id_noticia: "b", titulo: t, url: "https://x.com/2" })])).toHaveLength(0);
    const c = detectarContradicciones([n({ id_noticia: "a", titulo: "Balance de lluvias", descripcion: "Hay 3 muertos" }), n({ id_noticia: "b", titulo: "Balance de lluvias", descripcion: "Hay 5 muertos", url: "https://x.com/2" })]);
    expect(c[0].campo).toBe("descripcion");
  });
  test("mismas cifras → sin contradicción", () => {
    expect(detectarContradicciones([n({ id_noticia: "a", titulo: "3 muertos" }), n({ id_noticia: "b", titulo: "3 muertos confirmados", url: "https://x.com/2" })])).toHaveLength(0);
  });
});
