// Capa de servicio usada por las rutas API (y por las pruebas sin HTTP).
import { db } from "../db";
import { cargarSnapshot, type Snapshot } from "./cargar";
import { cincoTemas, consultar } from "./consulta";
import { generarPaquete } from "./paquete";
import { validarTransicion } from "./revision";
import { leerScoring } from "./config";
import type { EstadoRevision, Evento, Paquete } from "./contrato";
import { existsSync, readFileSync } from "fs";

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
  return { corteUTC: snap.manifest.fecha_corte_UTC, version: snap.manifest.version, eventos: snap.eventos.map(resumen), cinco: cincoTemas(snap).map((c) => ({ ...c, evento: resumen(c.evento) })) };
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
  return { evento: e, publicaciones: e.ids_noticia.map((i) => porId.get(i)).filter(Boolean), indicadores, sismos, revision, historial, paquete: guardado ? { ...(JSON.parse(guardado.contenido) as Paquete), modo: guardado.modo, persona: guardado.persona, updatedAt: guardado.updatedAt } : null };
}

export async function paquete(id: string, persona: string, forzar = false) {
  const snap = snapshot();
  const e = snap.eventos.find((x) => x.id === id);
  if (!e) return null;
  const existente = forzar ? null : await db.paqueteEditado.findUnique({ where: { eventoId: id } });
  if (existente) return JSON.parse(existente.contenido) as Paquete;
  const p = generarPaquete(e, snap.noticias, snap.indicadores);
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

export async function consulta(q: string, modo?: "embeddings" | "bm25", eventoId?: string) {
  const snap = snapshot();
  const soloIds = eventoId ? snap.eventos.find((e) => e.id === eventoId)?.ids_noticia : undefined;
  return consultar(q, snap, { modo, soloIds });
}

export async function control() {
  const snap = snapshot();
  const leer = (n: string) => (existsSync(`${snap.dir}/${n}`) ? JSON.parse(readFileSync(`${snap.dir}/${n}`, "utf8")) : null);
  return { manifest: snap.manifest, calidad: leer("calidad.json"), motor: leer("motor-meta.json"), reglas: leerScoring(), benchmark: leer("benchmark.json"), pruebas: leer("pruebas.json"), modo: process.env.AGENTETVN_MODO ?? "offline", decisiones: await db.decision.findMany({ orderBy: { createdAt: "asc" } }), revisiones: await db.revision.count() };
}
