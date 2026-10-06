// Clasificación temática · IA: similitud con la descripción de cada tema (zero-shot) · baseline: palabras clave.
import { coseno, embeber } from "./embeddings";
import { tokenizar } from "./bm25";
import { leerScoring, leerTemas, type TemaDef } from "./config";

export interface Clasificacion { tema: string; confianza: number; por_revisar: boolean; segundo: string; margen: number }

export type TemaVec = { id: string; vec: Float32Array | number[] };
let cacheTemas: TemaVec[] | null = null;
/** Varios prototipos por tema (descripción + cada palabra clave como frase corta): el puntaje del tema es el máximo. */
export async function vectoresTemas(): Promise<TemaVec[]> {
  if (cacheTemas) return cacheTemas;
  const defs = leerTemas();
  const protos = defs.flatMap((t) => [`${t.nombre}: ${t.descripcion}`, ...t.palabras.map((p) => `${t.nombre}: ${p}`)].map((texto) => ({ id: t.id, texto })));
  const vecs = await embeber(protos.map((p) => p.texto), "passage");
  return (cacheTemas = protos.map((p, i) => ({ id: p.id, vec: vecs[i] })));
}

export function clasificarTema(vecNoticia: Float32Array | number[], temasVec: TemaVec[], cfg = leerScoring().temas): Clasificacion {
  const mejorPorTema = new Map<string, number>();
  for (const t of temasVec) {
    const s = coseno(vecNoticia, t.vec);
    if (s > (mejorPorTema.get(t.id) ?? -1)) mejorPorTema.set(t.id, s);
  }
  const sims = [...mejorPorTema].map(([id, s]) => ({ id, s })).sort((a, b) => b.s - a.s);
  const [p, q] = sims;
  const margen = p.s - (q?.s ?? 0);
  return { tema: p.id, confianza: Math.round(p.s * 1000) / 1000, por_revisar: p.s < cfg.umbral || margen < cfg.margen, segundo: q?.id ?? "", margen: Math.round(margen * 1000) / 1000 };
}

/** La sección del RSS es metadato público: deportes es deportes, sin pasar por el modelo. */
export const SECCION_A_TEMA: Record<string, string> = { deportes: "deportes", economia: "economia" };

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
