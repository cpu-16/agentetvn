// Baseline léxico (BM25) · misma interfaz que la recuperación semántica. Es también el fallback sin modelo.
export interface BM25 {
  docs: { id: string; tokens: string[] }[];
  df: Map<string, number>;
  avgdl: number;
}

const STOP = new Set("de la el en y a los las del un una por con para que se al es su sus lo como más o este esta sin sobre entre tras ante hasta".split(" "));

export function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[a-z0-9ñ]+/g)
    ?.filter((t) => t.length > 1 && !STOP.has(t)) ?? [];
}

export function indexarBM25(docs: { id: string; texto: string }[]): BM25 {
  const df = new Map<string, number>();
  const toks = docs.map((d) => ({ id: d.id, tokens: tokenizar(d.texto) }));
  for (const d of toks) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const avgdl = toks.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, toks.length);
  return { docs: toks, df, avgdl };
}

export function buscarBM25(idx: BM25, consulta: string, k = 5, k1 = 1.5, b = 0.75): { id: string; score: number }[] {
  const q = tokenizar(consulta);
  const N = idx.docs.length;
  const res: { id: string; score: number }[] = [];
  for (const d of idx.docs) {
    let score = 0;
    const tf = new Map<string, number>();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = idx.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.tokens.length) / idx.avgdl)));
    }
    if (score > 0) res.push({ id: d.id, score });
  }
  return res.sort((x, y) => y.score - x.score).slice(0, k);
}

/** Jaccard de tokens (para titulares casi idénticos). */
export function jaccard(a: string, b: string): number {
  const A = new Set(tokenizar(a));
  const B = new Set(tokenizar(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
