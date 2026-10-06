// Perfiles de modelo de embeddings (experimento A/B del 6-oct-2026, docs/EXPERIMENTO-EMBEDDINGS-2026-10-06.md).
// AGENTETVN_EMB_MODELO elige el perfil; sin la variable rige «e5», el comportamiento de siempre.
// Un perfil sin `umbrales` usa los de config/scoring-v1.json (calibrados con e5). Los demás traen los suyos,
// reestimados por percentiles (scripts/calibrar-embeddings.ts, 6-oct-2026): las escalas de coseno no son comparables entre modelos.

export interface UmbralesPerfil { umbral_mismo_evento: number; umbral_coseno: number; umbral_tema: number; margen_tema: number }
export interface PerfilEmb {
  id: string;
  modelo: string; // repo ONNX en Hugging Face
  dtype: "q8";
  dim: number;
  /** cómo sale el vector: pooling del pipeline, o la salida `sentence_embedding` que ya trae el ONNX (media + capas densas) */
  pooling: "mean" | "cls" | "sentence_embedding";
  query: (t: string) => string;
  passage: (t: string) => string;
  umbrales: UmbralesPerfil | null;
}

export const PERFILES: Record<string, PerfilEmb> = {
  e5: { id: "e5", modelo: "Xenova/multilingual-e5-small", dtype: "q8", dim: 384, pooling: "mean", query: (t) => `query: ${t}`, passage: (t) => `passage: ${t}`, umbrales: null },
  gemma: { id: "gemma", modelo: "onnx-community/embeddinggemma-300m-ONNX", dtype: "q8", dim: 768, pooling: "sentence_embedding", query: (t) => `task: search result | query: ${t}`, passage: (t) => `title: none | text: ${t}`, umbrales: { umbral_mismo_evento: 0.6236, umbral_coseno: 0.1359, umbral_tema: 0.1915, margen_tema: 0.0481 } },
  granite: { id: "granite", modelo: "onnx-community/granite-embedding-97m-multilingual-r2-ONNX", dtype: "q8", dim: 384, pooling: "cls", query: (t) => t, passage: (t) => t, umbrales: { umbral_mismo_evento: 0.8274, umbral_coseno: 0.7093, umbral_tema: 0.6355, margen_tema: 0.0186 } },
};

export function perfilActivo(nombre = process.env.AGENTETVN_EMB_MODELO || "e5"): PerfilEmb {
  const p = PERFILES[nombre];
  if (!p) throw new Error(`AGENTETVN_EMB_MODELO=${nombre} no existe; perfiles: ${Object.keys(PERFILES).join(", ")}`);
  return p;
}
export const PERFIL: PerfilEmb = perfilActivo();
