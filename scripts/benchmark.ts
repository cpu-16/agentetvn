// ─────────────────────────────────────────────────────────────
// benchmark · corre las consultas de data/benchmark/benchmark.jsonl y reporta numerador/denominador por tipo.
//   bun run benchmark --split dev            (modo embeddings y bm25, ambos)
//   bun run benchmark --split reservado      (solo una vez, al congelar; no se ajusta con él)
//   bun run benchmark --etiquetas            (macro-F1 de temas y P/R de pares contra data/labels/)
// Salidas: data/processed/benchmark-<split>.json y benchmark.json (resumen para la vista Control).
// ─────────────────────────────────────────────────────────────
import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { cargarSnapshot } from "../src/lib/motor/cargar";
import { consultar } from "../src/lib/motor/consulta";
import { clasificarTema, temaPorPalabras, vectoresTemas } from "../src/lib/motor/temas";
import { coseno, modeloDisponible } from "../src/lib/motor/embeddings";
import { jaccard } from "../src/lib/motor/bm25";
import { leerScoring } from "../src/lib/motor/config";
import { escribirJson } from "../src/lib/ingesta/escribir";

type Tipo = "sustentada" | "contradiccion" | "sin_respuesta" | "adversarial";
interface Caso { id: string; tipo: Tipo; split: "dev" | "reservado"; consulta: string; evidencia_esperada?: string[]; nota?: string; sintetica?: boolean; revisado_por?: string }

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const split = (arg("--split") ?? "dev") as "dev" | "reservado";
const OUT = "data/processed";
const snap = cargarSnapshot(OUT, { forzar: true });
const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const p95 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] : 0);
const resumen: Record<string, unknown> = { fecha: new Date().toISOString(), split, snapshot: snap.manifest.version, reglas: leerScoring().version };

if (process.argv.includes("--etiquetas") || !existsSync("data/benchmark/benchmark.jsonl")) {
  // Clasificación de temas: macro-F1 IA (kNN sobre embeddings no: zero-shot) vs baseline palabras, contra etiquetas humanas
  if (existsSync("data/labels/temas.csv")) {
    const et = parse(readFileSync("data/labels/temas.csv", "utf8"), { columns: true, skip_empty_lines: true }) as { id_noticia: string; tema: string; revisado_por: string }[];
    const etiquetadas = et.filter((e) => e.tema && e.revisado_por);
    const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
    const emb = snap.embeddings;
    const temasVec = (await modeloDisponible()) ? await vectoresTemas() : [];
    const pred = { ia: new Map<string, string>(), base: new Map<string, string>() };
    for (const e of etiquetadas) {
      const n = porId.get(e.id_noticia);
      if (!n) continue;
      const i = emb?.ids.indexOf(e.id_noticia) ?? -1;
      if (emb && i >= 0 && temasVec.length) pred.ia.set(e.id_noticia, n.seccion === "deportes" ? "deportes" : clasificarTema(emb.vectores[i], temasVec).tema);
      pred.base.set(e.id_noticia, n.seccion === "deportes" ? "deportes" : (temaPorPalabras(`${n.titulo} ${n.descripcion}`) ?? "otro"));
    }
    const macroF1 = (p: Map<string, string>) => {
      const clases = [...new Set(etiquetadas.map((e) => e.tema))];
      const f1s = clases.map((c) => {
        const tp = etiquetadas.filter((e) => e.tema === c && p.get(e.id_noticia) === c).length;
        const fp = etiquetadas.filter((e) => e.tema !== c && p.get(e.id_noticia) === c).length;
        const fn = etiquetadas.filter((e) => e.tema === c && p.get(e.id_noticia) !== c).length;
        const pr = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0;
        return { clase: c, n: tp + fn, f1: pr + rc ? (2 * pr * rc) / (pr + rc) : 0 };
      });
      return { macro_f1: Math.round((f1s.reduce((s, x) => s + x.f1, 0) / Math.max(1, f1s.length)) * 1000) / 1000, exactitud: Math.round((etiquetadas.filter((e) => p.get(e.id_noticia) === e.tema).length / etiquetadas.length) * 1000) / 1000, por_clase: f1s };
    };
    resumen.temas = { n: etiquetadas.length, etiquetadores: [...new Set(etiquetadas.map((e) => e.revisado_por))], ia: pred.ia.size ? macroF1(pred.ia) : null, baseline: macroF1(pred.base) };
  }
  if (existsSync("data/labels/pares.csv")) {
    const pares = (parse(readFileSync("data/labels/pares.csv", "utf8"), { columns: true, skip_empty_lines: true }) as { a: string; b: string; mismo_evento: string; revisado_por: string }[]).filter((p) => p.mismo_evento && p.revisado_por);
    const emb = snap.embeddings!;
    const idx = new Map(emb.ids.map((id, i) => [id, i]));
    const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
    const cfg = leerScoring().N;
    const evaluar = (pred: (a: string, b: string) => boolean) => {
      let tp = 0, fp = 0, fn = 0;
      for (const p of pares) {
        const y = p.mismo_evento === "si", yh = pred(p.a, p.b);
        if (y && yh) tp++; else if (!y && yh) fp++; else if (y && !yh) fn++;
      }
      const pr = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0;
      return { precision: Math.round(pr * 1000) / 1000, recall: Math.round(rc * 1000) / 1000, f1: Math.round((pr + rc ? (2 * pr * rc) / (pr + rc) : 0) * 1000) / 1000, tp, fp, fn };
    };
    resumen.pares = {
      n: pares.length,
      umbral: cfg.umbral_mismo_evento,
      ia: evaluar((a, b) => idx.has(a) && idx.has(b) && coseno(emb.vectores[idx.get(a)!], emb.vectores[idx.get(b)!]) >= cfg.umbral_mismo_evento),
      baseline: evaluar((a, b) => jaccard(porId.get(a)?.titulo ?? "", porId.get(b)?.titulo ?? "") >= 0.55),
    };
  }
}

if (existsSync("data/benchmark/benchmark.jsonl")) {
  const casos = readFileSync("data/benchmark/benchmark.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso).filter((c) => c.split === split);
  const porModo: Record<string, unknown> = {};
  for (const modo of ["embeddings", "bm25"] as const) {
    const filas: Record<string, unknown>[] = [];
    const ms: number[] = [];
    for (const c of casos) {
      const r = await consultar(c.consulta, snap, { modo });
      ms.push(r.ms);
      const ids = r.evidencias.map((e) => e.id);
      const hit = c.evidencia_esperada?.length ? c.evidencia_esperada.some((e) => ids.includes(e)) : null;
      const citas_ok = r.afirmaciones.every((a) => !!a.evidence_id);
      const ok = c.tipo === "sin_respuesta" || c.tipo === "adversarial" ? r.abstener || (c.tipo === "adversarial" && !r.evidencias.some((e) => snap.noticias.find((n) => n.id_noticia === e.id)?.no_confiable)) : !r.abstener && (hit ?? true);
      filas.push({ id: c.id, tipo: c.tipo, consulta: c.consulta, abstuvo: r.abstener, hit, citas_ok, ok, ms: r.ms, evidencias: ids });
    }
    const por = (t: Tipo) => filas.filter((f) => f.tipo === t);
    porModo[modo] = {
      n: casos.length,
      sustentadas: { ok: por("sustentada").filter((f) => f.ok).length, n: por("sustentada").length, hit5: por("sustentada").filter((f) => f.hit).length },
      contradiccion: { ok: por("contradiccion").filter((f) => f.ok).length, n: por("contradiccion").length },
      abstencion: { correctas: por("sin_respuesta").filter((f) => f.abstuvo).length, n: por("sin_respuesta").length, abstenciones_incorrectas: por("sustentada").filter((f) => f.abstuvo).length, de_respondibles: por("sustentada").length },
      adversarial: { resistidos: por("adversarial").filter((f) => f.ok).length, n: por("adversarial").length },
      cobertura_citas: { con_cita: filas.filter((f) => f.citas_ok).length, n: filas.length },
      ms: { mediana: mediana(ms), p95: p95(ms) },
      filas,
    };
  }
  resumen.consultas = porModo;
}
escribirJson(`${OUT}/benchmark-${split}.json`, resumen);
if (split === "dev" || !existsSync(`${OUT}/benchmark.json`)) escribirJson(`${OUT}/benchmark.json`, resumen);
console.log(JSON.stringify({ ...resumen, consultas: resumen.consultas ? Object.fromEntries(Object.entries(resumen.consultas as Record<string, { filas: unknown }>).map(([k, v]) => [k, { ...v, filas: undefined }])) : undefined }, null, 2));
