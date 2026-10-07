import { conTraza } from "./tracing";
// Consulta en español sobre el snapshot (CU-01, CU-04, T06): recuperación semántica (o léxica) → afirmaciones tipadas con cita → abstención explícita.
import { coseno, DIM, embeber, MODELO, modeloDisponible } from "./embeddings";
import { buscarBM25, indexarBM25, tokenizar, type BM25 } from "./bm25";
import { CONCEPTO_INDICADOR, idIndicador } from "./contexto";
import { temaDesconocido } from "./intencion";
import { leerScoring } from "./config";
import { INDICADORES, PAISES } from "../ingesta/bancomundial";
import type { Afirmacion, Contradiccion, Evento, Indicador, MetaLLM, Noticia } from "./contrato";
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
  redaccion?: { frases: Afirmacion[]; vacios: string[]; llm: MetaLLM }; // solo en modo online, sobre lo recuperado
  conversacion?: { motivo: string; texto: string; sugerencias: string[] }; // el enrutador contestó sin buscar
  guia?: Guia; // una parte de la pantalla que hay que mostrar (navegar, bajar, resaltar, demostrar)
  agenda?: { uno: boolean; texto: string; items: { eventoId: string; idNoticia: string; titulo: string; medio: string; P: number; rango: string; evidencia: string; razon: string; falta: string | null; publicaciones: number }[] };
  traza?: Traza; // cómo se buscó: lo dibuja el chat
}
/** Traza de la recuperación para mostrarla: vector de la pregunta (primeras 48 dims), distribución de similitudes del corpus,
 *  umbral, los mejores (usados y los primeros descartados) y el tiempo de cada paso. */
export interface Guia { parte?: string; vista: string; eventoId?: string; ancla: string; demo?: import("../voz/guia").Demo; titulo: string; texto?: string; siguiente?: string; siguienteTitulo?: string; paso?: number; total?: number }
export interface Traza {
  modo: "embeddings" | "bm25";
  modelo?: string; dim?: number; vector?: number[];
  comparadas: number; umbral?: number; margen?: number; sobreUmbral: number; k: number;
  histograma?: { desde: number; hasta: number; cuentas: number[] };
  mejores: { id: string; medio: string; titulo: string; score: number; usada: boolean }[];
  pasos: { paso: string; ms: number }[];
  regla?: string; // la pregunta se resolvió por una regla (sin búsqueda): cuál y por qué
}
const porRegla = (modo: Traza["modo"], k: number, regla: string): Traza => ({ modo, comparadas: 0, sobreUmbral: 0, k, mejores: [], pasos: [], regla });
/** Además del umbral, se usan solo las que quedan a ≤ 0,02 de la mejor: el e5 comprime la escala y por encima de 0,80 entraban
 *  notas de otro tema (p. ej. «aprehensión de Enrique Lau» traía otros arrestos). Benchmark dev 6-oct: mismas hit@5 17/20,
 *  abstenciones 6/7 (0 indebidas), adversarial 6/6 y citas 38/38; evidencias por consulta de 3,84 a 1,55. Fuera del JSON
 *  de reglas para no cambiar la huella del motor v1. */
export const MARGEN_COSENO = 0.02;
/** TVN es el cliente: a igual parecido, su nota va primero. Bono pequeño que solo ordena; el umbral y el margen se miden
 *  contra el coseno real (si no, la nota de TVN dejaba fuera a las que la corroboran). EXP_BONO_TVN solo para medir. */
export const BONO_TVN = Number(process.env.EXP_BONO_TVN ?? 0.01);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
export function histograma(scores: number[], bins = 28): Traza["histograma"] {
  if (!scores.length) return undefined;
  const desde = Math.floor(Math.min(...scores) * 50) / 50, hasta = Math.ceil(Math.max(...scores) * 50) / 50 || 1;
  const cuentas = new Array(bins).fill(0);
  for (const x of scores) cuentas[Math.min(bins - 1, Math.floor(((x - desde) / (hasta - desde || 1)) * bins))]++;
  return { desde, hasta, cuentas };
}

export const LEYENDA = "Basado únicamente en titular/metadatos del corte; no se leyó el artículo completo.";
const PAIS_NOMBRE: Record<string, RegExp> = { PAN: /panam/i, CRI: /costa rica/i, COL: /colombia/i, DOM: /dominican/i, MEX: /m[eé]xico/i, GTM: /guatemala/i };
const nombreIndicador = (id: string) => INDICADORES[id]?.nombre ?? id;
export const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(/\.\s*,/, ",") : "fecha no disponible");

let bm25: { idx: BM25; huella: string } | null = null;
function indice(snap: Snapshot): BM25 {
  if (!bm25 || bm25.huella !== snap.huella) bm25 = { idx: indexarBM25(snap.noticias.filter((n) => !n.no_confiable).map((n) => ({ id: n.id_noticia, texto: `${n.titulo} ${n.descripcion}` }))), huella: snap.huella };
  return bm25.idx;
}
/** Títulos que no son noticias: el de la página («Preview - …», «X - Noticias de …», Wikipedia) o una sección que el mismo
 *  medio repite 3 o más veces («Se escucha por ahí»). No entran como evidencia ni en «Cinco para hoy»: con preguntas cortas
 *  atraían la búsqueda por sentido («hola» → «EL DÍA - Noticias de Bolivia para el mundo»). */
export const TITULO_DE_PAGINA = /^\s*(preview|vista previa)\s*[-–|]|wikipedia|^[^-–|]{2,40}\s[-–|]\s*noticias de /i;
const genericos = new WeakMap<object, Set<string>>();
export function idsGenericos(snap: Pick<Snapshot, "noticias">): Set<string> {
  let ids = genericos.get(snap);
  if (ids) return ids;
  const clave = (n: Noticia) => `${n.medio}|${n.titulo.trim().toLowerCase()}`;
  const veces = new Map<string, number>();
  for (const n of snap.noticias) veces.set(clave(n), (veces.get(clave(n)) ?? 0) + 1);
  ids = new Set(snap.noticias.filter((n) => TITULO_DE_PAGINA.test(n.titulo) || (veces.get(clave(n)) ?? 0) >= 3).map((n) => n.id_noticia));
  genericos.set(snap, ids);
  return ids;
}
/** ¿La palabra (ya tokenizada) aparece en alguna publicación del corte? */
export function enCorpus(snap: Snapshot, token: string): boolean {
  return indice(snap).docs.some((d) => d.tokens.includes(token));
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
    return { ...base, abstener: true, motivo: `El corte solo cubre PAN, CRI, COL, DOM, MEX y GTM; el país consultado no está.`, faltante: `serie ${nombreIndicador(d.indicador)} (${d.indicador}) del país consultado`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
  // «hoy/actualmente» se resuelve contra el corte del snapshot (reproducible), no contra el reloj
  const anioCorte = Number(snap.manifest.fecha_corte_UTC.slice(0, 4));
  if (d.anio === "corte") d.anio = anioCorte;
  const serie = snap.indicadores.filter((i) => i.pais_iso3 === d.pais && i.indicador_id === d.indicador);
  if (d.anio !== null) {
    const fila = serie.find((i) => i.anio === d.anio);
    if (!fila || fila.valor === null) {
      const disponibles = serie.filter((i) => i.valor !== null).map((i) => i.anio);
      return { ...base, abstener: true, motivo: `El corte no contiene ${nombreIndicador(d.indicador)} de ${d.pais} para ${d.anio}.`, faltante: `valor de ${nombreIndicador(d.indicador)} (${d.indicador}) para ${d.pais} en ${d.anio}; años disponibles con valor: ${disponibles.length ? `${disponibles[0]}–${disponibles[disponibles.length - 1]}` : "ninguno"}`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
    }
    return { ...base, abstener: false, afirmaciones: [afirmacionIndicador(fila)], evidencias: [evidenciaIndicador(fila)], ms: Date.now() - t0 };
  }
  const ult = serie.filter((i) => i.valor !== null).sort((a, b) => b.anio - a.anio)[0];
  if (!ult) return { ...base, abstener: true, motivo: `No hay valores de ${nombreIndicador(d.indicador)} para ${d.pais} en el corte.`, faltante: `serie ${d.indicador} de ${d.pais}`, afirmaciones: [], evidencias: [], ms: Date.now() - t0 };
  return { ...base, abstener: false, afirmaciones: [afirmacionIndicador(ult), { texto: `Es el último año con valor publicado; no es una medición de hoy.`, tipo: "inferencia", evidence_id: idIndicador(ult), campo: "anio", alcance: "fila_indicador" }], evidencias: [evidenciaIndicador(ult)], ms: Date.now() - t0 };
}

const fmtValor = (v: number | null, unidad: string) => (v === null ? "nulo" : unidad === "personas" ? Math.round(v).toLocaleString("es-PA") : (Math.round(v * 100) / 100).toLocaleString("es-PA", { maximumFractionDigits: 2 }));
export const afirmacionIndicador = (i: Indicador): Afirmacion => ({ texto: `${nombreIndicador(i.indicador_id)} de ${i.pais_iso3} en ${i.anio}: ${fmtValor(i.valor, i.unidad)} ${i.unidad} (Banco Mundial; contexto histórico).`, tipo: "hecho_reportado", evidence_id: idIndicador(i), campo: "valor", alcance: "fila_indicador" });
export const evidenciaIndicador = (i: Indicador): Evidencia => ({ id: idIndicador(i), tipo: "indicador", resumen: `${i.pais_iso3}, ${i.indicador_id}, ${i.anio}: ${fmtValor(i.valor, i.unidad)} ${i.unidad} (${i.licencia})`, score: 1 });
export const afirmacionNoticia = (n: Noticia): Afirmacion => ({ texto: `El titular de ${n.medio} (${hora(n.fecha_publicacion ?? n.fecha_deteccion)}${n.fecha_publicacion ? "" : ", fecha de detección"}) reporta: «${n.titulo}».`, tipo: "hecho_reportado", evidence_id: n.id_noticia, campo: "titulo", alcance: "titular_metadatos" });
/** Oraciones del extracto del RSS como hechos reportados (campo descripcion); una declaración atribuida («X dijo/explicó») se marca como declaración. */
export const afirmacionesExtracto = (n: Noticia, max = 3): Afirmacion[] =>
  (n.descripcion || "")
    .split(/(?<=[.!?])\s+/)
    .map((o) => o.trim())
    .filter((o) => o.length > 25)
    .slice(0, max)
    .map((o) => ({ texto: `Según el extracto de ${n.medio}: ${o.endsWith(".") ? o : o + "."}`, tipo: /\b(dijo|explicó|aseguró|afirmó|señaló|indicó|sostuvo|según)\b/i.test(o) ? ("declaracion" as const) : ("hecho_reportado" as const), evidence_id: n.id_noticia, campo: "descripcion", alcance: "titular_metadatos" as const }));

async function consultarImpl(q: string, snap: Snapshot, opts: { modo?: "embeddings" | "bm25"; k?: number; soloIds?: string[] } = {}): Promise<Respuesta> {
  const t0 = Date.now();
  const cfg = leerScoring().consulta;
  const k = opts.k ?? cfg.k;
  const usarEmb = opts.modo !== "bm25" && snap.embeddings && (await modeloDisponible());
  const modo: Respuesta["modo"] = usarEmb ? "embeddings" : "bm25";
  // causalidad/culpa/pérdidas: abstención ANTES de cualquier otra rama (también si menciona un indicador)
  // \b no funciona tras una vocal acentuada («qué»): se usan límites Unicode
  if (/(?<![\p{L}])(por qu[eé]|caus[oó]|culpa|culpable|p[eé]rdidas?|quebr|impago|fraude)/iu.test(q))
    return { abstener: true, motivo: "El corpus (titulares y metadatos) no permite establecer causas, culpas ni pérdidas.", faltante: "cobertura con fuentes primarias y lectura completa de los artículos", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA, traza: porRegla(modo, k, "Pide causas, culpas o pérdidas: me abstengo antes de buscar, porque los titulares no alcanzan para eso.") };
  // fuera de alcance (§2 del reto): datos de clientes, crédito, solvencia, audiencia, expedientes, secretos
  if (/(?<![\p{L}])(cliente|calificaci[oó]n crediticia|solvencia|riesgo de cr[eé]dito|cartera|rating|audiencia|expediente|c[eé]dula|token|contraseña|clave de)/iu.test(q))
    return { abstener: true, motivo: "Fuera del alcance del reto: no hay datos de clientes, crédito, solvencia, audiencia ni expedientes en el corpus, y el agente no maneja secretos.", faltante: "nada: esta consulta no se responde desde este sistema", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA, traza: porRegla(modo, k, "Fuera del alcance del reto: no se busca.") };
  const cifra = responderCifra(q, snap, t0, modo);
  if (cifra) return { ...cifra, traza: porRegla(modo, k, "Pide una cifra oficial: la leí directo de la serie del Banco Mundial, sin búsqueda por sentido.") };
  // Después de las reglas y de los indicadores («desempleo» no sale en las noticias, pero sí en las series): si el tema no
  // aparece en ninguna publicación, abstenerse diciéndolo (T06), en vez de devolver lo que «suena parecido» por sentido.
  const desconocido = temaDesconocido(tokenizar(q), (t) => enCorpus(snap, t));
  if (desconocido !== null)
    return { abstener: true, motivo: desconocido ? `No encontré «${desconocido}» en las noticias del corte.` : "No entendí sobre qué tema es la pregunta.", faltante: desconocido ? `publicaciones del corte que mencionen «${desconocido}» (si es un nombre, prueba escribirlo de otra forma)` : "un tema, una persona, un lugar o un indicador", afirmaciones: [], evidencias: [], contradicciones: [], modo, ms: Date.now() - t0, leyenda: LEYENDA, traza: porRegla(modo, k, desconocido ? `«${desconocido}» no aparece en ninguna publicación del corte: me abstengo antes de buscar por sentido.` : "Sin tema: me abstengo antes de buscar.") };
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const pideCantidad = /(?<![\p{L}])(cu[aá]nt[oa]s?|cifra|monto|tasa|porcentaje|cu[aá]l fue el (valor|n[uú]mero|total)|cu[aá]ntos?)/iu.test(q);
  const generico = idsGenericos(snap);
  const permitida = (id: string) => porId.has(id) && !porId.get(id)!.no_confiable && !generico.has(id) && (!opts.soloIds || opts.soloIds.includes(id));
  let candidatos: { id: string; score: number }[] = [];
  let modoEfectivo: Respuesta["modo"] = modo;
  let traza: Traza | undefined;
  const mejores = (orden: { id: string; score: number }[], usadas: Set<string>) => orden.slice(0, k + 3).map((c) => ({ id: c.id, medio: porId.get(c.id)!.medio, titulo: porId.get(c.id)!.titulo, score: r3(c.score), usada: usadas.has(c.id) })); // por pertenencia (revisión de Codex)
  if (usarEmb) {
    try {
      const t1 = Date.now();
      const [qv] = await embeber([q], "query");
      const t2 = Date.now();
      const emb = snap.embeddings!;
      const todos = emb.ids.map((id, i) => ({ id, score: coseno(qv, emb.vectores[i]) })).filter((c) => permitida(c.id))
        .map((c) => ({ ...c, orden: c.score + (porId.get(c.id)!.medio === "TVN" ? BONO_TVN : 0) })).sort((a, b) => b.orden - a.orden);
      const t3 = Date.now();
      const sobreUmbral = todos.filter((c) => c.score >= cfg.umbral_coseno);
      const mejor = Math.max(...todos.map((c) => c.score)); // el margen se mide contra el coseno real: el bono de TVN solo ordena
      candidatos = sobreUmbral.filter((c) => c.score >= mejor - MARGEN_COSENO).slice(0, k);
      traza = { modo: "embeddings", modelo: MODELO, dim: DIM, vector: Array.from(qv.slice(0, 48), (x) => Math.round(x * 1000) / 1000), comparadas: todos.length, umbral: cfg.umbral_coseno, margen: MARGEN_COSENO, sobreUmbral: sobreUmbral.length, k,
        histograma: histograma(todos.map((c) => c.score)), mejores: mejores(todos, new Set(candidatos.map((c) => c.id))), pasos: [{ paso: "vectorizar", ms: t2 - t1 }, { paso: "comparar", ms: t3 - t2 }] };
    } catch {
      modoEfectivo = "bm25"; // modelo presente pero no cargable: fallback documentado (T10)
    }
  }
  if (modoEfectivo === "bm25") {
    // «relacionado» no es «sustentado»: se exige que al menos la mitad de los términos de la consulta (mínimo 2) aparezcan en el documento
    const qTokens = [...new Set(tokenizar(q))];
    const minimo = Math.max(2, Math.ceil(qTokens.length / 2));
    const t1 = Date.now();
    const idx = indice(snap);
    const tokensDe = new Map(idx.docs.map((d) => [d.id, new Set(d.tokens)]));
    const orden = buscarBM25(idx, q, k * 3).filter((c) => permitida(c.id));
    candidatos = orden.filter((c) => qTokens.filter((t) => tokensDe.get(c.id)?.has(t)).length >= minimo).slice(0, k);
    const usadas = new Set(candidatos.map((c) => c.id));
    traza = { modo: "bm25", comparadas: idx.docs.length, sobreUmbral: candidatos.length, k, mejores: orden.slice(0, k + 3).map((c) => ({ id: c.id, medio: porId.get(c.id)!.medio, titulo: porId.get(c.id)!.titulo, score: r3(c.score), usada: usadas.has(c.id) })), pasos: [{ paso: "buscar palabras", ms: Date.now() - t1 }] };
  }
  if (!candidatos.length)
    return { abstener: true, motivo: "No hay evidencia en el corte que responda la consulta.", faltante: "noticias o indicadores sobre ese tema dentro de la ventana del corte", afirmaciones: [], evidencias: [], contradicciones: [], modo: modoEfectivo, ms: Date.now() - t0, leyenda: LEYENDA, traza };
  // si se pide una cantidad y ningún titular/extracto recuperado contiene una cifra, lo recuperado es «relacionado», no «respuesta»
  const tieneCifra = (t: string) => [...t.matchAll(/\d+(?:[.,]\d+)?/g)].some((m) => !/^(19|20)\d{2}$/.test(m[0])); // un año suelto no es una cifra
  if (pideCantidad && !candidatos.some((c) => tieneCifra(`${porId.get(c.id)!.titulo} ${porId.get(c.id)!.descripcion}`)))
    return { abstener: true, motivo: "Las publicaciones relacionadas no contienen la cifra solicitada; no se infiere un número.", faltante: `la cifra pedida con su fuente y período; publicaciones relacionadas: ${candidatos.slice(0, 3).map((c) => porId.get(c.id)!.medio).join(", ")}`, afirmaciones: [], evidencias: candidatos.map((c) => ({ id: c.id, tipo: "noticia" as const, resumen: `${porId.get(c.id)!.medio} · ${porId.get(c.id)!.titulo}`, score: Math.round(c.score * 1000) / 1000 })), contradicciones: [], modo: modoEfectivo, ms: Date.now() - t0, leyenda: LEYENDA, traza };
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
    traza,
  };
}

/** CU-01 · los cinco temas que merecen revisión, con razones y vacíos. */
export function cincoTemas(snap: Snapshot): { evento: Evento; razones: string[]; vacios: string[] }[] {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  // cinco temas distintos para una agenda: máximo dos eventos del mismo tema (el orden sigue siendo por P)
  const porTema = new Map<string, number>();
  const generico = idsGenericos(snap);
  const elegidos: Evento[] = [];
  for (const e of snap.eventos) {
    if (e.no_confiable || e.tema === "deportes" || e.tema === "otro" || e.ids_noticia.some((i) => porId.get(i)?.sintetica)) continue;
    if (generico.has(e.representante)) continue; // sin titular real no se puede revisar desde la portada
    if ((porTema.get(e.tema) ?? 0) >= 2) continue;
    porTema.set(e.tema, (porTema.get(e.tema) ?? 0) + 1);
    elegidos.push(e);
    if (elegidos.length === 5) break;
  }
  return elegidos
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

export async function consultar(...args: Parameters<typeof consultarImpl>): Promise<Respuesta> {
  return conTraza("recuperacion", { snapshot: args[1].huella }, () => consultarImpl(...args), "retriever");
}
