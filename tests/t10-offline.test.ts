// T10 · Sin internet durante la demo: funcionar con snapshot y fallback documentado.
// Se bloquea fetch() en el proceso: cualquier intento de red falla. Consulta, cinco temas y paquete deben seguir funcionando.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

describe("T10 sin internet", () => {
  const fetchOriginal = globalThis.fetch;
  afterAll(() => { globalThis.fetch = fetchOriginal; }); // el bloqueo de red no se filtra a otras pruebas del mismo proceso
  beforeAll(() => {
    process.env.HF_HUB_OFFLINE = "1";
    process.env.AGENTETVN_MODO = "offline";
    globalThis.fetch = (() => { throw new Error("T10: sin red"); }) as unknown as typeof fetch;
  });
  test("snapshot verificado, consulta responde (embeddings en caché o BM25) y abstención funciona sin red", async () => {
    const { cargarSnapshot } = await import("../src/lib/motor/cargar");
    const { consultar, cincoTemas } = await import("../src/lib/motor/consulta");
    const { generarPaquete } = await import("../src/lib/motor/paquete");
    const snap = cargarSnapshot("data/processed", { forzar: true });
    expect(snap.eventos.length).toBeGreaterThan(0);
    const r = await consultar("¿Qué se sabe del Canal de Panamá?", snap);
    expect(["embeddings", "bm25"]).toContain(r.modo);
    expect(r.ms).toBeLessThan(15000);
    const a = await consultar("¿Cuál fue la inflación de Panamá en 2031?", snap);
    expect(a.abstener).toBe(true);
    expect(cincoTemas(snap).length).toBeGreaterThan(0);
    const p = generarPaquete(snap.eventos[0], snap.noticias, snap.indicadores);
    expect(p.modo).toBe("extractivo");
  }, 60000);
  test("modo online sin red: la redacción con IA cae a la versión extractiva y lo dice", async () => {
    const { redactarOExtractivo } = await import("../src/lib/motor/llm");
    process.env.AGENTETVN_MODO = "online";
    process.env.LLM_BASE_URL = "http://127.0.0.1:8766/v1";
    process.env.LLM_REGISTRO = "/dev/null";
    const base = { titulo: "t", enfoque: "e", brief: [{ texto: "x", tipo: "hecho_reportado" as const, evidence_id: "a", campo: "titulo", alcance: "titular_metadatos" as const }], preguntas: [], verificaciones: [], guion: [], copy: [], leyenda: "l", modo: "extractivo" as const };
    const p = await redactarOExtractivo(base, [{ id: "a", campo: "titulo", alcance: "titular_metadatos", texto: "x" }], "");
    process.env.AGENTETVN_MODO = "offline";
    delete process.env.LLM_BASE_URL;
    expect(p.modo).toBe("extractivo");
    expect(p.brief).toEqual(base.brief);
    expect(p.verificaciones.at(-1)).toContain("Redacción con IA no disponible");
  });
});
