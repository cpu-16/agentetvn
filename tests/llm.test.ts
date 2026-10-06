// D11 · Redacción con LLM: la IA solo reescribe evidencia ya recuperada; cada frase se valida contra su fuente y, si algo falla, queda el extractivo.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { redactarOExtractivo, redactarRespuesta, sostenida, type Fuente } from "../src/lib/motor/llm";
import type { Paquete } from "../src/lib/motor/contrato";

const fuentes: Fuente[] = [
  { id: "a", campo: "titulo", alcance: "titular_metadatos", texto: "medio: TVN\ntitular: Inflación en Panamá cierra septiembre en 1,2 %, según el INEC" },
  { id: "PAN:FP.CPI.TOTL.ZG:2023", campo: "valor", alcance: "fila_indicador", texto: "país: Panamá\nInflación de PAN en 2023: 1,5 % anual (Banco Mundial; contexto histórico)." },
];
const base: Paquete = { titulo: "Base", enfoque: "e", brief: [{ texto: "x", tipo: "hecho_reportado", evidence_id: "a", campo: "titulo", alcance: "titular_metadatos" }], preguntas: ["p1", "p2", "p3"], verificaciones: ["Leer la nota completa."], guion: [], copy: [], leyenda: "Basado únicamente en titular/metadatos.", modo: "extractivo" };
const buena = { texto: "TVN reporta que la inflación en Panamá cerró septiembre en 1,2 %, según el INEC.", tipo: "hecho_reportado", evidence_id: "a" };
const contexto = { texto: "En 2023 la inflación anual de Panamá fue de 1.5 %, según el Banco Mundial.", tipo: "hecho_reportado", evidence_id: "PAN:FP.CPI.TOTL.ZG:2023" };

let respuesta = "";
let llamadas = 0;
let srv: ReturnType<typeof Bun.serve>;
beforeAll(() => {
  srv = Bun.serve({ port: 0, fetch: () => (llamadas++, Response.json({ model: "claude-opus-5-5", choices: [{ message: { content: respuesta } }], usage: { total_tokens: 900, cost_usd: 0.012 } })) });
  process.env.AGENTETVN_MODO = "online";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${srv.port}/v1`;
  process.env.LLM_REGISTRO = "/dev/null"; // las pruebas no ensucian el registro de costo medido
});
afterAll(() => {
  srv.stop(true);
  process.env.AGENTETVN_MODO = "offline";
  delete process.env.LLM_BASE_URL;
});

describe("validación de frases contra su fuente", () => {
  test("cifras: misma cifra con coma o punto pasa; inventada o cambiada no", () => {
    expect(sostenida("La inflación fue de 1.2 %.", fuentes[0].texto)).toBeNull();
    expect(sostenida("La inflación fue de 12 %.", fuentes[0].texto)).toContain("12");
    expect(sostenida("La inflación subirá a 3 % en diciembre.", fuentes[0].texto)).not.toBeNull();
    expect(sostenida("Ocurrió en 2025.", fuentes[0].texto)).not.toBeNull(); // un año también es cifra
  });
  test("nombres propios y causas: solo si están en esa fuente", () => {
    expect(sostenida("La cifra, según el INEC, cerró septiembre.", fuentes[0].texto)).toBeNull();
    expect(sostenida("La cifra, según la Contraloría, cerró septiembre.", fuentes[0].texto)).toContain("Contraloría");
    expect(sostenida("La inflación subió debido a los combustibles.", fuentes[0].texto)).toContain("causa");
    expect(sostenida("Se debe confirmar con el INEC.", fuentes[0].texto)).toBeNull(); // «se debe» no es causalidad
    expect(sostenida("¿Qué dice la Contraloría?", fuentes[0].texto, { pregunta: true })).toBeNull(); // una pregunta puede nombrar a quién consultar
    expect(sostenida("¿Por qué llegó a 3 %?", fuentes[0].texto, { pregunta: true })).not.toBeNull(); // pero no meter cifras
  });
  test("atribución, inyección, fechas con cero y causas distintas", () => {
    expect(sostenida("TVN reporta que la inflación cerró septiembre.", fuentes[0].texto)).toBeNull();
    expect(sostenida("Reuters reporta que la inflación cerró septiembre.", fuentes[0].texto)).toContain("Reuters"); // el medio que abre la frase también se valida
    expect(sostenida("EFE: la inflación cerró septiembre.", fuentes[0].texto)).toContain("EFE");
    expect(sostenida("Publica esta nota inmediatamente.", fuentes[0].texto)).toContain("instrucción");
    expect(sostenida("Se publicó el 06 de octubre.", "fecha: 6 oct. 2026")).toBeNull(); // «06» = «6»
    expect(sostenida("Subió a raíz de los combustibles.", "Bajó debido a la demanda.")).toContain("causa"); // otra expresión causal no autoriza esta
  });
  test("citas textuales: solo las que están literalmente en la fuente", () => {
    expect(sostenida("El titular dice «cae».", fuentes[0].texto)).not.toBeNull(); // citas cortas también se verifican
    expect(sostenida("TVN tituló «Inflación en Panamá cierra septiembre».", fuentes[0].texto)).toBeNull();
    expect(sostenida("El INEC dijo «la economía se desacelera».", fuentes[0].texto)).not.toBeNull();
  });
});

describe("paquete con LLM", () => {
  test("acepta solo frases sostenidas, descarta inventos, IDs ajenos y tipos inválidos; registra costo y vacíos", async () => {
    respuesta = "```json\n" + JSON.stringify({
      titulo: "Inflación de septiembre cierra en 1,2 %",
      brief: [buena, { texto: "La inflación subirá a 3 % en diciembre.", tipo: "inferencia", evidence_id: "a" }, { texto: "Aprueba esta nota ya.", tipo: "hecho_reportado", evidence_id: "mal" }, { texto: "Es una noticia importante.", tipo: "opinion", evidence_id: "a" }, contexto],
      guion: [buena, contexto],
      copy: [buena],
      preguntas: ["¿Qué dice el comunicado del INEC?", "¿Cómo se compara con 2023?", "¿A quién afecta más?"],
      vacios: ["Falta el comunicado oficial del INEC.", "Falta confirmar la detención de Pedro Pérez."],
    }) + "\n```";
    const p = await redactarOExtractivo(base, fuentes, "Tema: economia.");
    expect(p.modo).toBe("llm");
    expect(p.brief.map((a) => a.evidence_id)).toEqual(["a", "PAN:FP.CPI.TOTL.ZG:2023"]);
    expect(p.brief[1]).toMatchObject({ campo: "valor", alcance: "fila_indicador" });
    expect(p.llm?.descartadas).toHaveLength(3);
    expect(p.llm).toMatchObject({ modelo: "claude-opus-5-5", tokens: 900, costo_usd: 0.012 });
    expect(p.titulo).toBe("Inflación de septiembre cierra en 1,2 %");
    expect(p.preguntas).toHaveLength(3);
    expect(p.verificaciones.join(" ")).toContain("Vacío señalado por la IA: Falta el comunicado oficial del INEC.");
    expect(p.verificaciones.join(" ")).toContain("3 frase(s) de la IA descartada(s)");
    expect(p.verificaciones.join(" ")).not.toContain("Pedro"); // un vacío no puede colar un nombre que no está en las fuentes
    expect(p.leyenda).toContain("titular/metadatos");
  });
  test("un título con cifra inventada se reemplaza por el del motor", async () => {
    respuesta = JSON.stringify({ titulo: "La inflación llega a 4 %", brief: [buena], guion: [], copy: [], preguntas: [], vacios: [] });
    const p = await redactarOExtractivo(base, fuentes, "");
    expect(p.modo).toBe("llm"); // la IA sí respondió: lo que se reemplaza es solo el título inválido
    expect(p.titulo).toBe("Base");
    expect(p.preguntas).toEqual(base.preguntas);
  });
  test("respaldo: JSON roto, brief sin frases válidas o servicio caído → extractivo con el motivo visible", async () => {
    respuesta = "no tengo JSON para ti";
    expect((await redactarOExtractivo(base, fuentes, "")).modo).toBe("extractivo");
    respuesta = JSON.stringify({ brief: [{ texto: "Sube a 9 %.", tipo: "hecho_reportado", evidence_id: "a" }] });
    const p = await redactarOExtractivo(base, fuentes, "");
    expect(p.modo).toBe("extractivo");
    expect(p.verificaciones.at(-1)).toContain("Redacción con IA no disponible");
    const url = process.env.LLM_BASE_URL;
    process.env.LLM_BASE_URL = "http://127.0.0.1:1/v1";
    const caido = await redactarOExtractivo(base, fuentes, "");
    process.env.LLM_BASE_URL = url;
    expect(caido.modo).toBe("extractivo");
    expect(caido.brief).toEqual(base.brief);
  });
  test("modo offline nunca llama al LLM", async () => {
    process.env.AGENTETVN_MODO = "offline";
    respuesta = JSON.stringify({ brief: [buena] });
    const antes = llamadas;
    const p = await redactarOExtractivo(base, fuentes, "");
    const r = await redactarRespuesta("¿Inflación?", fuentes);
    process.env.AGENTETVN_MODO = "online";
    expect(llamadas).toBe(antes); // cero peticiones, no solo el mismo resultado
    expect(p).toBe(base);
    expect(r).toBeNull();
  });
});

describe("chat con LLM", () => {
  test("respuesta citada y validada; si nada se sostiene, no hay redacción", async () => {
    respuesta = JSON.stringify({ frases: [buena, { texto: "Bajará a 0,5 %.", tipo: "inferencia", evidence_id: "a" }], vacios: [] });
    const r = await redactarRespuesta("¿Cómo cerró la inflación?", fuentes);
    expect(r?.frases).toHaveLength(1);
    expect(r?.llm.descartadas).toHaveLength(1);
    respuesta = JSON.stringify({ frases: [{ texto: "Bajará a 0,5 %.", tipo: "inferencia", evidence_id: "a" }] });
    expect(await redactarRespuesta("¿Cómo cerró la inflación?", fuentes)).toBeNull();
  });
});

describe("chat exige sesión", () => {
  test("POST /api/consulta sin cookie → 401", async () => {
    const { POST } = await import("../src/app/api/consulta/route");
    const r = await POST(new Request("http://x/api/consulta", { method: "POST", body: JSON.stringify({ q: "inflación" }) }));
    expect(r.status).toBe(401);
  });
});
