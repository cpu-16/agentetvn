// Consulta en español sobre el snapshot (CU-01, CU-04, T06): recuperación semántica (o léxica) → afirmaciones tipadas con cita → abstención explícita.
import { coseno, embeber, modeloDisponible } from "./embeddings";
import { buscarBM25, indexarBM25, tokenizar, type BM25 } from "./bm25";
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

let bm25: { idx: BM25; huella: string } | null = null;
function indice(snap: Snapshot): BM25 {
  if (!bm25 || bm25.huella !== snap.huella) bm25 = { idx: indexarBM25(snap.noticias.filter((n) => !n.no_confiable).map((n) => ({ id: n.id_noticia, texto: `${n.titulo} ${n.descripcion}` }))), huella: snap.huella };
  return bm25.idx;
}
const OTRO_PAIS = /\b(honduras|nicaragua|el salvador|venezuela|ecuador|per[uú]|chile|argentina|brasil|bolivia|uruguay|paraguay|cuba|espa[ñn]a|estados unidos|eeuu|europa|china|rusia|jap[oó]n|canad[aá])\b/i;

/** ¿La consulta pide una cifra de indicador? → {indicador, pais, anio} */
export function detectarCifra(q: string): { indicador: string; pais: string; anio: number | "corte" | null } | null {
  const c = CONCEPTO_INDICADOR.find((c) => c.re.test(q));
  if (!c) return null;
  const soportado = PAISES.find((p) => PAIS_NOMBRE[p].test(q));
  const pais = soportado ?? (OTRO_PAIS.test(q) ? "OTRO" : "PAN"); // un país explícito no soportado NO se sustituye por Panamá
  const m = /\b(\d{4})\b/.exec(q); // cualquier año explícito, esté o no en el corpus
  const hoy = /\b(hoy|actual(mente)?|ahora|este a[ñn]o|[uú]ltim[oa]|reciente|al d[ií]a de hoy)\b/i.test(q);
  return { indicador: c.id, pais, anio: m ? Number(m[1]) : hoy ? "corte" : null };
}

function responderCifra(q: string, snap: Snapshot, t0: number, modo: Respuesta["modo"]): Respuesta | null {
  const d = detectarCifra(q);
  if (!d) return null;
  const base = { contradicciones: [], modo, leyenda: LEYENDA };
  if (d.pais === "OTRO")
    return { ...base, abstener: true, motivo: `El snapshot solo cubre PAN, CRI, COL, DOM, MEX y GTM; el país consultado no está.`, faltante: `serie ${nombreIndicador(d.indicador)} (${d.indicador}) del país consultado`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
  // «hoy/actualmente» se resuelve contra el corte del snapshot (reproducible), no contra el reloj
  const anioCorte = Number(snap.manifest.fecha_corte_UTC.slice(0, 4));
  if (d.anio === "corte") d.anio = anioCorte;
  const serie = snap.indicadores.filter((i) => i.pais_iso3 === d.pais && i.indicador_id === d.indicador);
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
  // causalidad/culpa/pérdidas: abstención ANTES de cualquier otra rama (también si menciona un indicador)
  // \b no funciona tras una vocal acentuada («qué»): se usan límites Unicode
  if (/(?<![\p{L}])(por qu[eé]|caus[oó]|culpa|culpable|p[eé]rdidas?|quebr|impago|fraude)/iu.test(q))
    return { abstener: true, motivo: "El corpus (titulares y metadatos) no permite establecer causas, culpas ni pérdidas.", faltante: "cobertura con fuentes primarias y lectura completa de los artículos", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA };
  // fuera de alcance (§2 del reto): datos de clientes, crédito, solvencia, audiencia, expedientes, secretos
  if (/(?<![\p{L}])(cliente|calificaci[oó]n crediticia|solvencia|riesgo de cr[eé]dito|cartera|rating|audiencia|expediente|c[eé]dula|token|contraseña|clave de)/iu.test(q))
    return { abstener: true, motivo: "Fuera del alcance del reto: no hay datos de clientes, crédito, solvencia, audiencia ni expedientes en el corpus, y el agente no maneja secretos.", faltante: "nada: esta consulta no se responde desde este sistema", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA };
  const cifra = responderCifra(q, snap, t0, modo);
  if (cifra) return cifra;
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const pideCantidad = /(?<![\p{L}])(cu[aá]nt[oa]s?|cifra|monto|tasa|porcentaje|cu[aá]l fue el (valor|n[uú]mero|total)|cu[aá]ntos?)/iu.test(q);
  const permitida = (id: string) => porId.has(id) && !porId.get(id)!.no_confiable && (!opts.soloIds || opts.soloIds.includes(id));
  let candidatos: { id: string; score: number }[] = [];
  let modoEfectivo: Respuesta["modo"] = modo;
  if (usarEmb) {
    try {
      const [qv] = await embeber([q], "query");
      const emb = snap.embeddings!;
      candidatos = emb.ids.map((id, i) => ({ id, score: coseno(qv, emb.vectores[i]) })).filter((c) => permitida(c.id) && c.score >= cfg.umbral_coseno).sort((a, b) => b.score - a.score).slice(0, k);
    } catch {
      modoEfectivo = "bm25"; // modelo presente pero no cargable: fallback documentado (T10)
    }
  }
  if (modoEfectivo === "bm25") {
    // «relacionado» no es «sustentado»: se exige que al menos la mitad de los términos de la consulta (mínimo 2) aparezcan en el documento
    const qTokens = [...new Set(tokenizar(q))];
    const minimo = Math.max(2, Math.ceil(qTokens.length / 2));
    const idx = indice(snap);
    const tokensDe = new Map(idx.docs.map((d) => [d.id, new Set(d.tokens)]));
    candidatos = buscarBM25(idx, q, k * 3)
      .filter((c) => permitida(c.id) && qTokens.filter((t) => tokensDe.get(c.id)?.has(t)).length >= minimo)
      .slice(0, k);
  }
  if (!candidatos.length)
    return { abstener: true, motivo: "No hay evidencia en el snapshot que responda la consulta.", faltante: "noticias o indicadores sobre ese tema dentro de la ventana del snapshot", afirmaciones: [], evidencias: [], contradicciones: [], modo: modoEfectivo, ms: Date.now() - t0, leyenda: LEYENDA };
  // si se pide una cantidad y ningún titular/extracto recuperado contiene una cifra, lo recuperado es «relacionado», no «respuesta»
  if (pideCantidad && !candidatos.some((c) => /\d/.test(`${porId.get(c.id)!.titulo} ${porId.get(c.id)!.descripcion}`)))
    return { abstener: true, motivo: "Las publicaciones relacionadas no contienen la cifra solicitada; no se infiere un número.", faltante: `la cifra pedida con su fuente y período; publicaciones relacionadas: ${candidatos.slice(0, 3).map((c) => porId.get(c.id)!.medio).join(", ")}`, afirmaciones: [], evidencias: candidatos.map((c) => ({ id: c.id, tipo: "noticia" as const, resumen: `${porId.get(c.id)!.medio} · ${porId.get(c.id)!.titulo}`, score: Math.round(c.score * 1000) / 1000 })), contradicciones: [], modo: modoEfectivo, ms: Date.now() - t0, leyenda: LEYENDA };
  const noticias = candidatos.map((c) => porId.get(c.id)!);
  const eventos = snap.eventos.filter((e) => e.ids_noticia.some((i) => candidatos.some((c) => c.id === i)));
  return {
    abstener: false,
    afirmaciones: noticias.map(afirmacionNoticia),
    evidencias: candidatos.map((c) => ({ id: c.id, tipo: "noticia" as const, resumen: `${porId.get(c.id)!.medio} · ${porId.get(c.id)!.titulo}`, score: Math.round(c.score * 1000) / 1000 })),
    contradicciones: eventos.flatMap((e) => e.contradicciones.filter((c) => permitida(c.a) && permitida(c.b))),
    modo: modoEfectivo,
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
