// Clasificación temática · IA: similitud con la descripción de cada tema (zero-shot) · baseline: palabras clave.
import { coseno, embeber } from "./embeddings";
import { tokenizar } from "./bm25";
import { leerScoring, leerTemas, type TemaDef } from "./config";

export interface Clasificacion { tema: string; confianza: number; por_revisar: boolean; segundo: string; margen: number }

let cacheTemas: { id: string; vec: Float32Array }[] | null = null;
export async function vectoresTemas(): Promise<{ id: string; vec: Float32Array }[]> {
  if (cacheTemas) return cacheTemas;
  const defs = leerTemas();
  const vecs = await embeber(defs.map((t) => `${t.nombre}. ${t.descripcion} Palabras: ${t.palabras.join(", ")}`), "passage");
  return (cacheTemas = defs.map((t, i) => ({ id: t.id, vec: vecs[i] })));
}

export function clasificarTema(vecNoticia: Float32Array | number[], temasVec: { id: string; vec: Float32Array | number[] }[], cfg = leerScoring().temas): Clasificacion {
  const sims = temasVec.map((t) => ({ id: t.id, s: coseno(vecNoticia, t.vec) })).sort((a, b) => b.s - a.s);
  const [p, q] = sims;
  const margen = p.s - (q?.s ?? 0);
  return { tema: p.id, confianza: Math.round(p.s * 1000) / 1000, por_revisar: p.s < cfg.umbral || margen < cfg.margen, segundo: q?.id ?? "", margen: Math.round(margen * 1000) / 1000 };
}

/** Baseline: tema con más palabras clave presentes; null si ninguna. */
export function temaPorPalabras(texto: string, defs: TemaDef[] = leerTemas()): string | null {
  const toks = new Set(tokenizar(texto));
  const plano = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let mejor: { id: string; n: number } | null = null;
  for (const t of defs) {
    const n = t.palabras.filter((p) => (p.includes(" ") ? plano.includes(p.normalize("NFD").replace(/[̀-ͯ]/g, "")) : toks.has(tokenizar(p)[0]))).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { id: t.id, n };
  }
  return mejor?.id ?? null;
}
