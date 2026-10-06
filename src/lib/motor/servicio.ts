// Capa de servicio usada por las rutas API (y por las pruebas sin HTTP).
import { db } from "../db";
import { cargarSnapshot, type Snapshot } from "./cargar";
import { cincoTemas, consultar, enCorpus, LEYENDA } from "./consulta";
import { intencion } from "./intencion";
import { tokenizar } from "./bm25";
import type { ContextoPantalla } from "../voz/catalogo";
import { generarPaquete } from "./paquete";
import { resumenCorte } from "./tablero";
import { fuentesDe, redactarOExtractivo, redactarRespuesta } from "./llm";
import { validarTransicion } from "./revision";
import { leerScoring } from "./config";
import type { EstadoRevision, Evento, Paquete } from "./contrato";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname } from "path";

export const snapshot = (): Snapshot => cargarSnapshot(undefined, { verificar: process.env.AGENTETVN_VERIFICAR_MANIFEST !== "0" });

export async function estadoDe(eventoId: string): Promise<{ estado: EstadoRevision; persona: string | null; motivo: string | null; createdAt: string | null }> {
  const r = await db.revision.findFirst({ where: { eventoId }, orderBy: { createdAt: "desc" } });
  return r ? { estado: r.estado as EstadoRevision, persona: r.persona, motivo: r.motivo, createdAt: r.createdAt.toISOString() } : { estado: "nuevo", persona: null, motivo: null, createdAt: null };
}

export async function agenda() {
  const snap = snapshot();
  const estados = await db.revision.findMany({ orderBy: { createdAt: "asc" } });
  const ultimo = new Map<string, EstadoRevision>();
  for (const r of estados) ultimo.set(r.eventoId, r.estado as EstadoRevision);
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const resumen = (e: Evento) => {
    const rep = porId.get(e.representante);
    return { ...e, titulo: rep?.titulo ?? "", medio: rep?.medio ?? "", sintetica: e.ids_noticia.some((i) => porId.get(i)?.sintetica), estado_revision: ultimo.get(e.id) ?? ("nuevo" as EstadoRevision), publicaciones: e.ids_noticia.length };
  };
  return { corteUTC: snap.manifest.fecha_corte_UTC, version: snap.manifest.version, resumen: resumenCorte(snap), eventos: snap.eventos.map(resumen), cinco: cincoTemas(snap).map((c) => ({ ...c, evento: resumen(c.evento) })) };
}

export async function evento(id: string) {
  const snap = snapshot();
  const e = snap.eventos.find((x) => x.id === id);
  if (!e) return null;
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const indicadores = e.contexto.indicadores.map((cid) => {
    const [pais, ind, anio] = cid.split(":");
    return snap.indicadores.find((i) => i.pais_iso3 === pais && i.indicador_id === ind && i.anio === Number(anio));
  }).filter(Boolean);
  const sismos = e.contexto.sismos.map((sid) => snap.sismos.find((s) => s.id === sid)).filter(Boolean);
  const revision = await estadoDe(id);
  const historial = await db.revision.findMany({ where: { eventoId: id }, orderBy: { createdAt: "asc" } });
  const guardado = await db.paqueteEditado.findUnique({ where: { eventoId: id } });
  const p = guardado ? (JSON.parse(guardado.contenido) as Paquete) : null;
  return { evento: e, publicaciones: e.ids_noticia.map((i) => porId.get(i)).filter(Boolean), indicadores, sismos, revision, historial, paquete: p && vigente(p, snap) ? { ...p, modo: guardado!.modo, persona: guardado!.persona, updatedAt: guardado!.updatedAt } : null };
}

/** Un paquete guardado sigue valiendo si no cita fuentes marcadas después como no confiables y, si lo redactó la IA, es del mismo snapshot. */
function vigente(p: Paquete, snap: Snapshot): boolean {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const contaminado = [...p.brief, ...p.guion, ...p.copy].some((a) => porId.get(a.evidence_id)?.no_confiable);
  return !contaminado && !(p.modo === "llm" && p.llm?.huella !== snap.huella);
}

// Una sola redacción en curso por evento: dos clics (o dos personas) comparten la misma llamada a la IA.
const enCurso = new Map<string, Promise<Paquete | null>>();

export function paquete(id: string, persona: string, forzar = false): Promise<Paquete | null> {
  const previa = enCurso.get(id);
  if (previa) return previa;
  const p = componerPaquete(id, persona, forzar).finally(() => enCurso.delete(id));
  enCurso.set(id, p);
  return p;
}

async function componerPaquete(id: string, persona: string, forzar: boolean): Promise<Paquete | null> {
  const snap = snapshot();
  const e = snap.eventos.find((x) => x.id === id);
  if (!e) return null;
  const t0 = new Date();
  const existente = forzar ? null : await db.paqueteEditado.findUnique({ where: { eventoId: id } });
  if (existente) {
    const p = JSON.parse(existente.contenido) as Paquete;
    if (vigente(p, snap)) return p; // si cita una fuente marcada después como no confiable o es de otro snapshot, se regenera
  }
  const base = generarPaquete(e, snap.noticias, snap.indicadores);
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const contexto = `Tema: ${e.tema}. Prioridad P ${e.P} (${e.rango}). Estado de la evidencia: ${e.estado_evidencia}. ${e.ids_noticia.length} publicación(es); procedencias: ${e.procedencias.map((x) => `${x.nombre} (${x.tipo})`).join(", ")}.${e.contradicciones.length ? ` Contradicciones abiertas: ${e.contradicciones.map((c) => c.detalle).join("; ")}.` : ""}`;
  const p = await redactarOExtractivo(base, fuentesDe([...base.brief, ...base.guion, ...base.copy], porId), contexto, snap.huella);
  const ahora = await db.paqueteEditado.findUnique({ where: { eventoId: id } });
  if (ahora && ahora.updatedAt > t0) // alguien guardó una edición mientras la IA redactaba (~40 s): no se pisa
    return { ...p, verificaciones: [...p.verificaciones, `No se guardó: ${ahora.persona} editó este paquete mientras se redactaba. Recarga para ver su versión.`] };
  await db.paqueteEditado.upsert({ where: { eventoId: id }, create: { eventoId: id, contenido: JSON.stringify(p), modo: p.modo, persona }, update: { contenido: JSON.stringify(p), modo: p.modo, persona } });
  return p;
}

export async function guardarPaquete(id: string, p: Paquete, persona: string) {
  await db.paqueteEditado.upsert({ where: { eventoId: id }, create: { eventoId: id, contenido: JSON.stringify(p), modo: p.modo, persona }, update: { contenido: JSON.stringify(p), modo: p.modo, persona } });
  return p;
}

export async function revisar(id: string, nuevo: EstadoRevision, persona: string, motivo?: string | null, evidenciaPendiente?: string | null) {
  if (!snapshot().eventos.some((e) => e.id === id)) return { ok: false as const, status: 404 as const, error: "evento no existe" };
  if (!persona?.trim()) return { ok: false as const, status: 400 as const, error: "persona responsable obligatoria" };
  const actual = (await estadoDe(id)).estado;
  const v = validarTransicion(actual, nuevo, motivo);
  if (!v.ok) return v;
  const r = await db.revision.create({ data: { eventoId: id, estado: nuevo, persona, motivo: motivo ?? null, evidenciaPendiente: evidenciaPendiente ?? null } });
  return { ok: true as const, revision: { estado: nuevo, persona, motivo: r.motivo, createdAt: r.createdAt.toISOString() }, nota: "Aprobar como borrador no publica." };
}

/** Registro de cada consulta (texto o voz) con sus pasos y tiempos: la traza queda en disco, no solo en la pantalla.
 *  Sin nombre de la persona. ponytail: JSONL que crece; rotarlo si pasa de unos MB. */
function registrar(origen: "texto" | "voz", q: string, r: Awaited<ReturnType<typeof consultar>>) {
  try {
    const archivo = process.env.AGENTETVN_REGISTRO ?? (process.env.NODE_ENV === "test" ? "/dev/null" : "db/consultas.jsonl"); // como db/llm-intentos.jsonl; las pruebas no ensucian el registro
    mkdirSync(dirname(archivo), { recursive: true });
    appendFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), origen, q, modo: r.modo, abstener: r.abstener, motivo: r.motivo, regla: r.traza?.regla, evidencias: r.evidencias.map((e) => [e.id, e.score]), sobre_umbral: r.traza?.sobreUmbral, pasos: r.traza?.pasos, ms: r.ms, llm: r.redaccion ? { ...r.redaccion.llm, descartadas: r.redaccion.llm.descartadas?.length ?? 0 } : null }) + "\n");
  } catch { /* el registro nunca tumba una respuesta */ }
}

export async function consulta(q: string, modo?: "embeddings" | "bm25", eventoId?: string, origen: "texto" | "voz" = "texto", contexto?: ContextoPantalla | null) {
  const t0 = Date.now();
  const snap = snapshot();
  const i = intencion(q, { tokens: tokenizar(q), enCorpus: (t) => enCorpus(snap, t), contexto });
  const r = i.tipo === "conversacion"
    ? { abstener: false, conversacion: { motivo: i.motivo, texto: i.texto, sugerencias: i.sugerencias }, afirmaciones: [], evidencias: [], contradicciones: [], modo: modo ?? "embeddings", ms: Date.now() - t0, leyenda: LEYENDA, traza: { modo: modo ?? "embeddings", comparadas: 0, sobreUmbral: 0, k: 0, mejores: [], pasos: [], regla: `Conversación (${i.motivo}): se contestó sin buscar.` } } as Awaited<ReturnType<typeof consultar>>
    : await consultaSinRegistro(q, modo, eventoId);
  registrar(origen, q, r);
  return r;
}

async function consultaSinRegistro(q: string, modo?: "embeddings" | "bm25", eventoId?: string) {
  const snap = snapshot();
  const ev = eventoId ? snap.eventos.find((e) => e.id === eventoId) : undefined;
  if (eventoId && !ev) // un tema que no existe no amplía la búsqueda a todo el corpus
    return { abstener: true, motivo: "Ese tema no existe en el corte actual.", faltante: "un tema de la agenda de hoy", afirmaciones: [], evidencias: [], contradicciones: [], modo: "bm25" as const, ms: 0, leyenda: LEYENDA };
  const soloIds = ev?.ids_noticia;
  const r = await consultar(q, snap, { modo, soloIds });
  if (r.abstener) return r; // las abstenciones son deterministas: nunca pasan por el LLM
  const redaccion = await redactarRespuesta(q, fuentesDe(r.afirmaciones, new Map(snap.noticias.map((n) => [n.id_noticia, n]))));
  return redaccion ? { ...r, redaccion } : r;
}

export async function control() {
  const snap = snapshot();
  const leer = (n: string) => (existsSync(`${snap.dir}/${n}`) ? JSON.parse(readFileSync(`${snap.dir}/${n}`, "utf8")) : null);
  return { manifest: snap.manifest, calidad: leer("calidad.json"), motor: leer("motor-meta.json"), reglas: leerScoring(), benchmark: leer("benchmark.json"), pruebas: leer("pruebas.json"), modo: process.env.AGENTETVN_MODO ?? "offline", decisiones: await db.decision.findMany({ orderBy: { createdAt: "asc" } }), revisiones: await db.revision.count() };
}
