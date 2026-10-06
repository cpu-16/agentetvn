// Embeddings locales con transformers.js (sin Python, sin GPU). Caché del modelo en ./.cache-modelos.
// Con HF_HUB_OFFLINE=1 nunca sale a la red: si el modelo no está en caché, lanza ModeloAusente.
import { existsSync } from "fs";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const MODELO = "Xenova/multilingual-e5-small";
export const DIM = 384;
const CACHE = process.env.AGENTETVN_CACHE_MODELOS ?? "./.cache-modelos";
env.cacheDir = CACHE;
env.allowRemoteModels = process.env.HF_HUB_OFFLINE !== "1";

export class ModeloAusente extends Error {}

let extractor: Promise<FeatureExtractionPipeline> | null = null;

export function modeloEnCache(): boolean {
  return existsSync(`${CACHE}/${MODELO}/onnx`) || existsSync(`${CACHE}/${MODELO.replace("/", "--")}`) || existsSync(`${CACHE}/models--${MODELO.replace("/", "--")}`);
}

export async function modeloDisponible(): Promise<boolean> {
  if (modeloEnCache()) return true;
  return env.allowRemoteModels; // online: se descargará
}

async function cargar(): Promise<FeatureExtractionPipeline> {
  if (!(await modeloDisponible())) throw new ModeloAusente(`${MODELO} no está en ${CACHE} y HF_HUB_OFFLINE=1`);
  extractor ??= pipeline("feature-extraction", MODELO, { dtype: "q8" }) as unknown as Promise<FeatureExtractionPipeline>;
  return extractor;
}

/** Vectores normalizados (coseno = producto punto). e5 exige prefijos "query: " / "passage: ". */
export async function embeber(textos: string[], prefijo: "query" | "passage"): Promise<Float32Array[]> {
  if (!textos.length) return [];
  const ext = await cargar();
  const out: Float32Array[] = [];
  for (let i = 0; i < textos.length; i += 32) {
    const lote = textos.slice(i, i + 32).map((t) => `${prefijo}: ${t}`);
    const r = await ext(lote, { pooling: "mean", normalize: true });
    const datos = r.data as Float32Array;
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
