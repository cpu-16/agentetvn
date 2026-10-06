// ─────────────────────────────────────────────────────────────
// calibrar-embeddings · reestima los cuatro umbrales de similitud de un perfil SIN etiquetas humanas
// (docs/EXPERIMENTO-EMBEDDINGS-2026-10-06.md §3). No toca data/processed ni el benchmark.
//   AGENTETVN_EMB_MODELO=e5 HF_HUB_OFFLINE=1 bun scripts/calibrar-embeddings.ts --referencia   (selectividad de hoy)
//   AGENTETVN_EMB_MODELO=granite HF_HUB_OFFLINE=1 bun scripts/calibrar-embeddings.ts           (umbrales del candidato)
// Salida: data/calibracion/calibracion-<perfil>.json (o AGENTETVN_CALIBRACION_DIR).
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync } from "fs";
import { coseno, embeber, MODELO } from "../src/lib/motor/embeddings";
import { PERFIL } from "../src/lib/motor/perfiles";
import { jaccard } from "../src/lib/motor/bm25";
import { SECCION_A_TEMA, temaPorPalabras, vectoresTemas } from "../src/lib/motor/temas";
import { leerScoring } from "../src/lib/motor/config";
import { sha256, type Noticia } from "../src/lib/motor/contrato";
import { escribirJson } from "../src/lib/ingesta/escribir";

const DIR = process.env.AGENTETVN_CALIBRACION_DIR ?? "data/calibracion";
const esReferencia = process.argv.includes("--referencia");
const t0 = Date.now();
const log = (s: string) => console.log(`[calibrar ${PERFIL.id} +${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

// ── utilidades ──
const cuantil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const p = (s.length - 1) * q, i = Math.floor(p), f = p - i;
  return i + 1 < s.length ? s[i] + f * (s[i + 1] - s[i]) : s[i];
};
const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]; // la misma del benchmark
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const resumen = (xs: number[]) => ({ n: xs.length, min: r4(Math.min(...xs)), p10: r4(cuantil(xs, 0.1)), p50: r4(cuantil(xs, 0.5)), p90: r4(cuantil(xs, 0.9)), p99: r4(cuantil(xs, 0.99)), max: r4(Math.max(...xs)) });
function prng(semilla: string) { // mulberry32 con semilla de texto: mismos pares para todos los modelos
  let a = parseInt(sha256(semilla).slice(0, 8), 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fechaRef = (n: Noticia) => n.fecha_publicacion ?? n.fecha_deteccion ?? n.fecha_extraccion;
const dias = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
const pasaje = (titulo: string, descripcion: string) => `${titulo}. ${descripcion}`.slice(0, 600); // igual que scripts/motor.ts

// ── corpus del motor (1 071 del CSV + 8 sintéticas); título/extracto/fechas no dependen del modelo ──
const noticias = JSON.parse(readFileSync("data/processed/noticias-motor.json", "utf8")) as Noticia[];
const textos = noticias.map((n) => pasaje(n.titulo, n.descripcion));
const vec = await embeber(textos, "passage");
log(`${vec.length} pasajes embebidos con ${MODELO}`);

// ── umbral_mismo_evento ──
// fáciles: Jaccard de titular ≥ 0,8 (sin pares de texto idéntico, que dan 1 por construcción)
const cfgN = leerScoring().N;
const faciles: number[] = [];
for (let i = 0; i < noticias.length; i++)
  for (let j = i + 1; j < noticias.length; j++)
    if (textos[i] !== textos[j] && jaccard(noticias[i].titulo, noticias[j].titulo) >= cfgN.jaccard_titular) faciles.push(coseno(vec[i], vec[j]));
// duros: paráfrasis fijas con Jaccard en [0,2; 0,5)
const sinteticas = JSON.parse(readFileSync("data/sinteticas.json", "utf8")) as { clave: string; titulo: string }[];
const parafrasis = (JSON.parse(readFileSync("data/calibracion/parafrasis-2026-10-06.json", "utf8")) as { pares: { clave: string; parafrasis: string }[] }).pares;
const original = (clave: string) => {
  if (clave.startsWith("sintetica:")) { const t = sinteticas.find((s) => s.clave === clave.slice(10))!.titulo; return noticias.findIndex((n) => n.sintetica && n.titulo === t); }
  return noticias.findIndex((n) => n.id_noticia === clave);
};
const duros0 = parafrasis.map((p) => ({ ...p, i: original(p.clave) })).filter((p) => p.i >= 0).map((p) => ({ ...p, j: jaccard(noticias[p.i].titulo, p.parafrasis) }));
const duros1 = duros0.filter((p) => p.j >= 0.2 && p.j < 0.5);
const vPar = await embeber(duros1.map((p) => pasaje(p.parafrasis, "")), "passage");
const duros = duros1.map((p, k) => ({ clave: p.clave, jaccard: r4(p.j), coseno: r4(coseno(vec[p.i], vPar[k])) }));
// negativos: pares al azar, ≤ 7 días, temaPorPalabras distinto (ambos con tema), Jaccard < 0,2
const conTema = noticias.map((n, i) => ({ n, i, t: temaPorPalabras(`${n.titulo} ${n.descripcion}`) })).filter((x) => !x.n.sintetica && x.t);
const azar = prng("negativos-2026-10-06");
const vistos = new Set<string>();
const negativos: number[] = [];
for (let intento = 0; intento < 200000 && negativos.length < 3000; intento++) {
  const a = conTema[Math.floor(azar() * conTema.length)], b = conTema[Math.floor(azar() * conTema.length)];
  const k = a.i < b.i ? `${a.i}-${b.i}` : `${b.i}-${a.i}`;
  if (a.i === b.i || vistos.has(k) || a.t === b.t || dias(fechaRef(a.n), fechaRef(b.n)) > cfgN.ventana_dias || jaccard(a.n.titulo, b.n.titulo) >= 0.2) continue;
  vistos.add(k);
  negativos.push(coseno(vec[a.i], vec[b.i]));
}
const p10d = cuantil(duros.map((d) => d.coseno), 0.1), p99n = cuantil(negativos, 0.99);
const hueco = p10d - p99n;
const umbralEvento = (p10d + p99n) / 2;
log(`mismo evento: duros ${duros.length}/${parafrasis.length} (p10 ${r4(p10d)}) · negativos ${negativos.length} (p99 ${r4(p99n)}) · hueco ${r4(hueco)} → ${r4(umbralEvento)}`);

// ── umbral_coseno: igualar la selectividad del e5 con 50 titulares como pseudoconsultas (leave-one-out) ──
const docs = noticias.map((n, i) => ({ n, i })).filter((x) => !x.n.no_confiable);
const muestra = docs.filter((x) => !x.n.sintetica).sort((a, b) => sha256(`${a.n.id_noticia}|pseudoconsultas-2026-10-06`).localeCompare(sha256(`${b.n.id_noticia}|pseudoconsultas-2026-10-06`))).slice(0, 50);
const vQ = await embeber(muestra.map((x) => x.n.titulo), "query");
const simsQ = muestra.map((x, k) => docs.filter((d) => d.i !== x.i).map((d) => coseno(vQ[k], vec[d.i])).sort((a, b) => b - a)); // descendente
const medianaPasan = (t: number) => mediana(simsQ.map((s) => s.filter((v) => v >= t).length));
const refPath = `${DIR}/calibracion-e5.json`;
type Ref = { consulta: { umbral: number; M: number }; temas: { umbral: number; margen: number; frac_bajo_umbral: number; frac_bajo_margen: number; frac_por_revisar: number } };
const ref: Ref | null = esReferencia ? null : existsSync(refPath) ? (JSON.parse(readFileSync(refPath, "utf8")) as Ref) : null;
if (!esReferencia && !ref) throw new Error(`falta ${refPath}: corre primero con AGENTETVN_EMB_MODELO=e5 y --referencia`);
let umbralConsulta: number, M: number;
if (esReferencia) {
  umbralConsulta = leerScoring().consulta.umbral_coseno;
  M = medianaPasan(umbralConsulta);
} else {
  M = ref!.consulta.M;
  // el mayor umbral cuya mediana de documentos que lo pasan llega a M (es el valor de algún s_q[M-1])
  const candidatos = [...new Set(simsQ.map((s) => s[Math.max(0, M - 1)]))].sort((a, b) => b - a);
  umbralConsulta = candidatos.find((t) => medianaPasan(t) >= M) ?? candidatos.at(-1)!;
}
log(`consulta: mediana de documentos ≥ umbral = ${medianaPasan(umbralConsulta)} (objetivo M=${M}) → ${r4(umbralConsulta)}`);

// ── temas.umbral y temas.margen: mismas fracciones «bajo umbral» y «bajo margen» que el e5 ──
const temasVec = await vectoresTemas();
const clasificables = noticias.map((n, i) => ({ n, i })).filter((x) => !(x.n.seccion && SECCION_A_TEMA[x.n.seccion] === "deportes") && temaPorPalabras(`${x.n.titulo} ${x.n.descripcion}`) !== "deportes");
const top = clasificables.map((x) => {
  const mejor = new Map<string, number>();
  for (const t of temasVec) { const s = coseno(vec[x.i], t.vec); if (s > (mejor.get(t.id) ?? -1)) mejor.set(t.id, s); }
  const s = [...mejor.values()].sort((a, b) => b - a);
  return { s: s[0], margen: s[0] - (s[1] ?? 0) };
});
const fracBajo = (u: number, m: number) => ({ bajo_umbral: top.filter((x) => x.s < u).length / top.length, bajo_margen: top.filter((x) => x.margen < m).length / top.length, por_revisar: top.filter((x) => x.s < u || x.margen < m).length / top.length });
let umbralTema: number, margenTema: number;
if (esReferencia) ({ umbral: umbralTema, margen: margenTema } = leerScoring().temas);
else { umbralTema = cuantil(top.map((x) => x.s), ref!.temas.frac_bajo_umbral); margenTema = cuantil(top.map((x) => x.margen), ref!.temas.frac_bajo_margen); }
const fr = fracBajo(umbralTema, margenTema);
log(`temas: ${top.length} clasificables · umbral ${r4(umbralTema)} margen ${r4(margenTema)} · por revisar ${(fr.por_revisar * 100).toFixed(1)} %`);

const salida = {
  fecha: new Date().toISOString(),
  perfil: PERFIL.id,
  modelo: MODELO,
  referencia: esReferencia,
  umbrales: { umbral_mismo_evento: r4(esReferencia ? cfgN.umbral_mismo_evento : umbralEvento), umbral_coseno: r4(umbralConsulta), umbral_tema: r4(umbralTema), margen_tema: r4(margenTema) },
  mismo_evento: { faciles: resumen(faciles), duros: { ...resumen(duros.map((d) => d.coseno)), descartadas_por_jaccard: duros0.length - duros1.length, pares: duros }, negativos: resumen(negativos), p10_duros: r4(p10d), p99_negativos: r4(p99n), hueco: r4(hueco), hueco_suficiente: hueco >= 0.05, umbral_por_metodo: r4(umbralEvento), umbral_vigente: cfgN.umbral_mismo_evento, faciles_bajo_umbral: faciles.filter((c) => c < (esReferencia ? cfgN.umbral_mismo_evento : umbralEvento)).length },
  consulta: { umbral: r4(umbralConsulta), M, mediana_lograda: medianaPasan(umbralConsulta), consultas: muestra.length, docs: docs.length - 1 },
  temas: { umbral: r4(umbralTema), margen: r4(margenTema), clasificables: top.length, frac_bajo_umbral: r4(fr.bajo_umbral), frac_bajo_margen: r4(fr.bajo_margen), frac_por_revisar: r4(fr.por_revisar), similitud_max: resumen(top.map((x) => x.s)) },
  ms: Date.now() - t0,
};
mkdirSync(DIR, { recursive: true });
escribirJson(`${DIR}/calibracion-${PERFIL.id}.json`, salida);
console.log(JSON.stringify(salida.umbrales));
