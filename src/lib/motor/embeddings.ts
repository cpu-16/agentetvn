// Embeddings locales con transformers.js (sin Python, sin GPU). Caché del modelo en ./.cache-modelos.
// Con HF_HUB_OFFLINE=1 nunca sale a la red: si el modelo no está en caché, lanza ModeloAusente.
// El modelo sale del perfil (AGENTETVN_EMB_MODELO, defecto e5): ver perfiles.ts.
import { existsSync } from "fs";
import { AutoModel, AutoTokenizer, env, pipeline, type FeatureExtractionPipeline, type Tensor } from "@huggingface/transformers";
import { PERFIL } from "./perfiles";

export const MODELO = PERFIL.modelo;
export const DIM = PERFIL.dim;
const CACHE = process.env.AGENTETVN_CACHE_MODELOS ?? "./.cache-modelos";
env.cacheDir = CACHE;
env.allowRemoteModels = process.env.HF_HUB_OFFLINE !== "1";

export class ModeloAusente extends Error {}

/** Lote de textos ya con prefijo → vectores normalizados aplanados [n × DIM]. Un proceso, un modelo. */
type Extractor = (textos: string[]) => Promise<Float32Array>;
let extractor: Promise<Extractor> | null = null;

export function modeloEnCache(): boolean {
  return existsSync(`${CACHE}/${MODELO}/onnx`) || existsSync(`${CACHE}/${MODELO.replace("/", "--")}`) || existsSync(`${CACHE}/models--${MODELO.replace("/", "--")}`);
}

export async function modeloDisponible(): Promise<boolean> {
  if (modeloEnCache()) return true;
  return env.allowRemoteModels; // online: se descargará
}

async function crearExtractor(): Promise<Extractor> {
  if (PERFIL.pooling === "sentence_embedding") {
    // EmbeddingGemma: el vector entrenado es la salida `sentence_embedding` del ONNX, no la media del último estado oculto
    const [tok, modelo] = await Promise.all([AutoTokenizer.from_pretrained(MODELO), AutoModel.from_pretrained(MODELO, { dtype: PERFIL.dtype })]);
    return async (textos) => {
      const { sentence_embedding } = (await modelo(tok(textos, { padding: true, truncation: true }))) as { sentence_embedding: Tensor };
      return sentence_embedding.normalize(2, -1).data as Float32Array;
    };
  }
  const pooling = PERFIL.pooling;
  const ext = (await pipeline("feature-extraction", MODELO, { dtype: PERFIL.dtype })) as unknown as FeatureExtractionPipeline;
  return async (textos) => (await ext(textos, { pooling, normalize: true })).data as Float32Array;
}

async function cargar(): Promise<Extractor> {
  if (!(await modeloDisponible())) throw new ModeloAusente(`${MODELO} no está en ${CACHE} y HF_HUB_OFFLINE=1`);
  extractor ??= crearExtractor();
  return extractor;
}

/** Vectores normalizados (coseno = producto punto). Cada perfil pone sus prefijos (e5: "query: " / "passage: "). */
export async function embeber(textos: string[], prefijo: "query" | "passage"): Promise<Float32Array[]> {
  if (!textos.length) return [];
  const ext = await cargar();
  const out: Float32Array[] = [];
  for (let i = 0; i < textos.length; i += 32) {
    const lote = textos.slice(i, i + 32).map(PERFIL[prefijo]);
    const datos = await ext(lote);
    for (let j = 0; j < lote.length; j++) out.push(datos.slice(j * DIM, (j + 1) * DIM));
  }
  return out;
}

export function coseno(a: Float32Array | number[], b: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function aLista(v: Float32Array): number[] {
  return Array.from(v, (x) => Math.round(x * 1e6) / 1e6);
}
