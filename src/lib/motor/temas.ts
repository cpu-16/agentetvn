// Clasificación temática · IA: similitud con la descripción de cada tema (zero-shot) · baseline: palabras clave.
import { existsSync, readFileSync } from "fs";
import { parse } from "csv-parse/sync";
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

/** kNN sobre etiquetas humanas (IA supervisada con pocas etiquetas): vota entre los k vecinos más parecidos. */
export function clasificarKnn(vec: Float32Array | number[], etiquetados: { id: string; vec: Float32Array | number[]; tema: string }[], k = 5, excluirId?: string): Clasificacion {
  const vecinos = etiquetados
    .filter((e) => e.id !== excluirId)
    .map((e) => ({ tema: e.tema, s: coseno(vec, e.vec) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
  const votos = new Map<string, number>();
  for (const v of vecinos) votos.set(v.tema, (votos.get(v.tema) ?? 0) + v.s);
  const orden = [...votos].sort((a, b) => b[1] - a[1]);
  const total = orden.reduce((s, [, v]) => s + v, 0) || 1;
  const conf = orden[0][1] / total;
  const margen = (orden[0][1] - (orden[1]?.[1] ?? 0)) / total;
  return { tema: orden[0][0], confianza: Math.round(conf * 1000) / 1000, por_revisar: conf < 0.5 || margen < 0.15, segundo: orden[1]?.[0] ?? "", margen: Math.round(margen * 1000) / 1000 };
}

/** Etiquetas humanas disponibles (tema + revisado_por) con su vector del snapshot. */
export function etiquetasConVector(snapEmb: { ids: string[]; vectores: number[][] } | null, rutaCsv = "data/labels/temas.csv"): { id: string; vec: number[]; tema: string }[] {
  if (!snapEmb || !existsSync(rutaCsv)) return [];
  const filas = parse(readFileSync(rutaCsv, "utf8"), { columns: true, skip_empty_lines: true }) as { id_noticia: string; tema: string; revisado_por: string }[];
  const idx = new Map(snapEmb.ids.map((id, i) => [id, i]));
  return filas.filter((f) => f.tema && f.tema !== "?" && f.revisado_por && idx.has(f.id_noticia)).map((f) => ({ id: f.id_noticia, vec: snapEmb.vectores[idx.get(f.id_noticia)!], tema: f.tema }));
}
