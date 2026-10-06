// Consulta en español sobre el snapshot (CU-01, CU-04, T06): recuperación semántica (o léxica) → afirmaciones tipadas con cita → abstención explícita.
import { coseno, embeber, modeloDisponible } from "./embeddings";
import { buscarBM25, indexarBM25, type BM25 } from "./bm25";
import { CONCEPTO_INDICADOR, idIndicador } from "./contexto";
import { leerScoring } from "./config";
import { INDICADORES, PAISES } from "../ingesta/bancomundial";
import type { Afirmacion, Contradiccion, Evento, Indicador, Noticia } from "./contrato";
import type { Snapshot } from "./cargar";

export interface Evidencia { id: string; tipo: "noticia" | "indicador" | "sismo"; resumen: string; score: number }
export interface Respuesta {
  abstener: boolean;
  motivo?: string;
  faltante?: string;
  afirmaciones: Afirmacion[];
  evidencias: Evidencia[];
  contradicciones: Contradiccion[];
  modo: "embeddings" | "bm25";
  ms: number;
  leyenda: string;
}

export const LEYENDA = "Basado únicamente en titular/metadatos del snapshot; no se leyó el artículo completo.";
const PAIS_NOMBRE: Record<string, RegExp> = { PAN: /panam/i, CRI: /costa rica/i, COL: /colombia/i, DOM: /dominican/i, MEX: /m[eé]xico/i, GTM: /guatemala/i };
const nombreIndicador = (id: string) => INDICADORES[id]?.nombre ?? id;
export const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(/\.\s*,/, ",") : "fecha no disponible");

let bm25: { idx: BM25; n: number } | null = null;
function indice(snap: Snapshot): BM25 {
  if (!bm25 || bm25.n !== snap.noticias.length) bm25 = { idx: indexarBM25(snap.noticias.filter((n) => !n.no_confiable).map((n) => ({ id: n.id_noticia, texto: `${n.titulo} ${n.descripcion}` }))), n: snap.noticias.length };
  return bm25.idx;
}

/** ¿La consulta pide una cifra de indicador? → {indicador, pais, anio} */
export function detectarCifra(q: string): { indicador: string; pais: string; anio: number | null } | null {
  const c = CONCEPTO_INDICADOR.find((c) => c.re.test(q));
  if (!c) return null;
  const pais = PAISES.find((p) => PAIS_NOMBRE[p].test(q)) ?? "PAN";
  const m = /\b(20\d{2}|19\d{2})\b/.exec(q);
  const hoy = /\b(hoy|actual|ahora|este a[ñn]o|[uú]ltim[oa]|reciente)\b/i.test(q);
  return { indicador: c.id, pais, anio: m ? Number(m[1]) : hoy ? new Date().getUTCFullYear() : null };
}

function responderCifra(q: string, snap: Snapshot, t0: number, modo: Respuesta["modo"]): Respuesta | null {
  const d = detectarCifra(q);
  if (!d) return null;
  const serie = snap.indicadores.filter((i) => i.pais_iso3 === d.pais && i.indicador_id === d.indicador);
  const base = { contradicciones: [], modo, leyenda: LEYENDA };
  if (d.anio !== null) {
    const fila = serie.find((i) => i.anio === d.anio);
    if (!fila || fila.valor === null) {
      const disponibles = serie.filter((i) => i.valor !== null).map((i) => i.anio);
      return { ...base, abstener: true, motivo: `El snapshot no contiene ${nombreIndicador(d.indicador)} de ${d.pais} para ${d.anio}.`, faltante: `valor de ${nombreIndicador(d.indicador)} (${d.indicador}) para ${d.pais} en ${d.anio}; años disponibles con valor: ${disponibles.length ? `${disponibles[0]}–${disponibles[disponibles.length - 1]}` : "ninguno"}`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
    }
    return { ...base, abstener: false, afirmaciones: [afirmacionIndicador(fila)], evidencias: [evidenciaIndicador(fila)], ms: Date.now() - t0 };
  }
  const ult = serie.filter((i) => i.valor !== null).sort((a, b) => b.anio - a.anio)[0];
  if (!ult) return { ...base, abstener: true, motivo: `No hay valores de ${nombreIndicador(d.indicador)} para ${d.pais} en el snapshot.`, faltante: `serie ${d.indicador} de ${d.pais}`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
  return { ...base, abstener: false, afirmaciones: [afirmacionIndicador(ult), { texto: `Es el último año con valor publicado; no es una medición de hoy.`, tipo: "inferencia", evidence_id: idIndicador(ult), campo: "anio", alcance: "fila_indicador" }], evidencias: [evidenciaIndicador(ult)], ms: Date.now() - t0 };
}

export const afirmacionIndicador = (i: Indicador): Afirmacion => ({ texto: `${nombreIndicador(i.indicador_id)} de ${i.pais_iso3} en ${i.anio}: ${i.valor} ${i.unidad} (Banco Mundial; contexto histórico).`, tipo: "hecho_reportado", evidence_id: idIndicador(i), campo: "valor", alcance: "fila_indicador" });
export const evidenciaIndicador = (i: Indicador): Evidencia => ({ id: idIndicador(i), tipo: "indicador", resumen: `${i.pais_iso3} · ${i.indicador_id} · ${i.anio} · ${i.valor ?? "nulo"} ${i.unidad} · ${i.licencia}`, score: 1 });
export const afirmacionNoticia = (n: Noticia): Afirmacion => ({ texto: `El titular de ${n.medio} (${hora(n.fecha_publicacion ?? n.fecha_deteccion)}${n.fecha_publicacion ? "" : ", fecha de detección"}) reporta: «${n.titulo}».`, tipo: "hecho_reportado", evidence_id: n.id_noticia, campo: "titulo", alcance: "titular_metadatos" });
/** Oraciones del extracto del RSS como hechos reportados (campo descripcion); una declaración atribuida («X dijo/explicó») se marca como declaración. */
export const afirmacionesExtracto = (n: Noticia, max = 3): Afirmacion[] =>
  (n.descripcion || "")
    .split(/(?<=[.!?])\s+/)
    .map((o) => o.trim())
    .filter((o) => o.length > 25)
    .slice(0, max)
    .map((o) => ({ texto: `Según el extracto de ${n.medio}: ${o.endsWith(".") ? o : o + "."}`, tipo: /\b(dijo|explicó|aseguró|afirmó|señaló|indicó|sostuvo|según)\b/i.test(o) ? ("declaracion" as const) : ("hecho_reportado" as const), evidence_id: n.id_noticia, campo: "descripcion", alcance: "titular_metadatos" as const }));

export async function consultar(q: string, snap: Snapshot, opts: { modo?: "embeddings" | "bm25"; k?: number; soloIds?: string[] } = {}): Promise<Respuesta> {
  const t0 = Date.now();
  const cfg = leerScoring().consulta;
  const k = opts.k ?? cfg.k;
  const usarEmb = opts.modo !== "bm25" && snap.embeddings && (await modeloDisponible());
  const modo: Respuesta["modo"] = usarEmb ? "embeddings" : "bm25";
  const cifra = responderCifra(q, snap, t0, modo);
  if (cifra) return cifra;
  if (/\b(por qu[eé]|caus[oó]|culpa|p[eé]rdidas?|quebr|impago|fraude)\b/i.test(q))
    return { abstener: true, motivo: "El corpus (titulares y metadatos) no permite establecer causas, culpas ni pérdidas.", faltante: "cobertura con fuentes primarias y lectura completa de los artículos", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA };
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const permitida = (id: string) => !porId.get(id)?.no_confiable && (!opts.soloIds || opts.soloIds.includes(id));
  let candidatos: { id: string; score: number }[] = [];
  if (usarEmb) {
    const [qv] = await embeber([q], "query");
    const emb = snap.embeddings!;
    candidatos = emb.ids.map((id, i) => ({ id, score: coseno(qv, emb.vectores[i]) })).filter((c) => permitida(c.id) && c.score >= cfg.umbral_coseno).sort((a, b) => b.score - a.score).slice(0, k);
  } else candidatos = buscarBM25(indice(snap), q, k * 2).filter((c) => permitida(c.id)).slice(0, k);
  if (!candidatos.length)
    return { abstener: true, motivo: "No hay evidencia en el snapshot que responda la consulta.", faltante: "noticias o indicadores sobre ese tema dentro de la ventana del snapshot", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA };
  const noticias = candidatos.map((c) => porId.get(c.id)!);
  const eventos = snap.eventos.filter((e) => e.ids_noticia.some((i) => candidatos.some((c) => c.id === i)));
  return {
    abstener: false,
    afirmaciones: noticias.map(afirmacionNoticia),
    evidencias: candidatos.map((c) => ({ id: c.id, tipo: "noticia" as const, resumen: `${porId.get(c.id)!.medio} · ${porId.get(c.id)!.titulo}`, score: Math.round(c.score * 1000) / 1000 })),
    contradicciones: eventos.flatMap((e) => e.contradicciones),
    modo,
    ms: Date.now() - t0,
    leyenda: LEYENDA,
  };
}

/** CU-01 · los cinco temas que merecen revisión, con razones y vacíos. */
export function cincoTemas(snap: Snapshot): { evento: Evento; razones: string[]; vacios: string[] }[] {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  return snap.eventos
    .filter((e) => !e.no_confiable && e.tema !== "deportes" && e.tema !== "otro" && !e.ids_noticia.some((i) => porId.get(i)?.sintetica))
    .slice(0, 5)
    .map((e) => {
      const ex = e.componentes.explicacion;
      const razones = [`P ${e.P} (${e.rango}): ${ex.R}`, ex.I, ex.U, ex.N, ex.E];
      const vacios: string[] = [];
      if (e.estado_evidencia !== "suficiente") vacios.push(`evidencia ${e.estado_evidencia}`);
      if (!e.contexto.indicadores.length && !e.contexto.sismos.length) vacios.push("sin dato oficial ligado");
      if (e.procedencias.some((p) => p.tipo === "no_verificada")) vacios.push("procedencia no verificada");
      if (e.contradicciones.length) vacios.push(`${e.contradicciones.length} contradicción(es) abierta(s)`);
      if (e.ids_noticia.every((i) => !porId.get(i)?.fecha_publicacion)) vacios.push("sin fecha de publicación (solo detección)");
      vacios.push("solo titular/metadatos: falta leer la nota completa");
      return { evento: e, razones, vacios };
    });
}
