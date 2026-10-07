import { db } from "../db";
import { snapshot } from "./servicio";
import { generarBoletin, validarBoletin } from "./banca";
import { sha256, type BoletinBancario, type EstadoRevision } from "./contrato";
import { validarTransicion } from "./revision";
import { actualizarTraza, conTraza } from "./tracing";

const enCurso = new Map<string, Promise<BoletinBancario | null>>();
const error = (status: 400 | 404 | 409, message: string) => ({ ok: false as const, status, error: message });
function vigente(value: string, id: string) {
  try {
    const snap = snapshot(), ev = snap.eventos.find((e) => e.id === id);
    if (!ev) return null;
    const result = validarBoletin(JSON.parse(value), ev, snap.noticias, snap.indicadores, snap.huella);
    return result.ok ? result.boletin : null;
  } catch { return null; }
}
export async function detalleBancario(id: string) {
  if (!snapshot().eventos.some((ev) => ev.id === id)) return null;
  const [guardado, historial] = await Promise.all([
    db.boletinBancario.findUnique({ where: { eventoId: id } }),
    db.revisionBancaria.findMany({ where: { eventoId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);
  const p = guardado ? vigente(guardado.contenido, id) : null;
  const last = historial.at(-1);
  return { boletin: p ? { ...p, persona: guardado!.persona, updatedAt: guardado!.updatedAt.toISOString() } : null,
    revision: last ? { id: last.id, estado: last.huella !== snapshot().huella ? "nuevo" as EstadoRevision
        : last.estado === "aprobado_borrador" && (!p || last.boletinVersion?.getTime() !== guardado!.updatedAt.getTime()) ? "en_revision" as EstadoRevision
        : last.estado as EstadoRevision, persona: last.persona, motivo: last.motivo, createdAt: last.createdAt.toISOString(),
        vigente: !!p && last.huella === snapshot().huella && last.boletinVersion?.getTime() === guardado!.updatedAt.getTime() }
      : { id: null, estado: "nuevo" as EstadoRevision, persona: null, motivo: null, createdAt: null, vigente: false },
    historial };
}
export function boletinBancario(id: string, persona: string, forzar = false): Promise<BoletinBancario | null> {
  const key = "banca:" + snapshot().huella + ":" + id;
  const previa = enCurso.get(key);
  if (previa) return previa;
  const task = conTraza("boletin-bancario", { modalidad: "banca" }, async () => {
    const snap = snapshot(), ev = snap.eventos.find((e) => e.id === id);
    if (!ev || !persona.trim()) return null;
    const previo = await db.boletinBancario.findUnique({ where: { eventoId: id } });
    const cache = previo ? vigente(previo.contenido, id) : null;
    if (cache && !forzar) {
      actualizarTraza({ cache: "hit", snapshot: snap.huella });
      return { ...cache, updatedAt: previo!.updatedAt.toISOString(), persona: previo!.persona };
    }
    actualizarTraza({ cache: "miss", snapshot: snap.huella });
    const b = generarBoletin(ev, snap.noticias, snap.indicadores, snap.huella);
    if (snapshot().huella !== snap.huella) return null;
    const data = { contenido: JSON.stringify(b), persona, updatedAt: new Date(Math.max(Date.now(), (previo?.updatedAt.getTime() ?? 0) + 1)) };
    if (previo) {
      const saved = await db.boletinBancario.updateMany({ where: { eventoId: id, updatedAt: previo.updatedAt }, data });
      if (!saved.count) return (await detalleBancario(id))?.boletin ?? null; // a newer human edition wins
    } else {
      try { await db.boletinBancario.create({ data: { eventoId: id, ...data } }); }
      catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        return (await detalleBancario(id))?.boletin ?? null;
      }
    }
    return (await detalleBancario(id))?.boletin ?? null;
  }).finally(() => enCurso.delete(key));
  enCurso.set(key, task);
  return task;
}
export async function guardarBoletinBancario(id: string, value: unknown, persona: string, version?: string) {
  const snap = snapshot(), ev = snap.eventos.find((e) => e.id === id);
  if (!ev) return error(404, "evento no existe");
  if (!persona.trim()) return error(400, "persona responsable obligatoria");
  const valid = validarBoletin(value, ev, snap.noticias, snap.indicadores, snap.huella);
  if (!valid.ok) return error(400, valid.error);
  if (!version || !Number.isFinite(new Date(version).getTime())) return error(409, "Recarga el boletín antes de guardar.");
  const update = await db.boletinBancario.updateMany({ where: { eventoId: id, updatedAt: new Date(version) },
    data: { contenido: JSON.stringify(valid.boletin), persona, updatedAt: new Date(Math.max(Date.now(), new Date(version).getTime() + 1)) } });
  if (!update.count) return error(409, "Otra persona cambió el boletín; recarga antes de guardar.");
  return { ok: true as const, detalle: await detalleBancario(id) };
}
export async function revisarBoletinBancario(id: string, nuevo: EstadoRevision, persona: string, motivo?: string | null,
  version?: string, revisionId: string | null = null, fuentesRevisadas = false) {
  if (motivo != null && typeof motivo !== "string") return error(400, "motivo inválido");
  const snap = snapshot();
  if (!snap.eventos.some((e) => e.id === id)) return error(404, "evento no existe");
  if (!persona.trim()) return error(400, "persona responsable obligatoria");
  const result = await db.$transaction(async (tx) => {
    const [draft, last] = await Promise.all([
      tx.boletinBancario.findUnique({ where: { eventoId: id } }),
      tx.revisionBancaria.findFirst({ where: { eventoId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    ]);
    const p = draft ? vigente(draft.contenido, id) : null;
    if ((last?.id ?? null) !== revisionId) {
      // Retry of the same durable decision acknowledges its original receipt.
      if (last?.estado === nuevo && last.persona === persona && last.motivo === (motivo?.trim() || null) &&
        last.fuentesRevisadas === fuentesRevisadas && last.huella === snap.huella &&
        (last.boletinVersion?.toISOString() ?? null) === (version ?? null) &&
        last.contenidoHash === (draft ? sha256(draft.contenido) : null))
        return { ok: true as const };
      return error(409, "La revisión cambió; recarga antes de decidir.");
    }
    const actual: EstadoRevision = !last || last.huella !== snap.huella ? "nuevo"
      : last.estado === "aprobado_borrador" && (!p || last.boletinVersion?.getTime() !== draft!.updatedAt.getTime()) ? "en_revision"
      : last.estado as EstadoRevision;
    const v = validarTransicion(actual, nuevo, motivo);
    if (!v.ok) return v;
    if (nuevo === "aprobado_borrador") {
      if (!p || p.abstener || draft!.updatedAt.toISOString() !== version) return error(409, "Recarga y revisa el boletín vigente con hechos citados.");
      if (!fuentesRevisadas) return error(400, "Confirma que revisaste las citas y el borrador exacto.");
    }
    await tx.revisionBancaria.create({ data: { eventoId: id, estado: nuevo, persona, motivo: motivo?.trim() || null,
      huella: snap.huella, boletinVersion: draft?.updatedAt, fuentesRevisadas,
      createdAt: new Date(Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1)),
      contenidoAprobado: nuevo === "aprobado_borrador" ? draft!.contenido : null,
      contenidoHash: draft ? sha256(draft.contenido) : null } });
    return { ok: true as const };
  });
  return result.ok ? { ok: true as const, detalle: await detalleBancario(id), nota: "Aprobar como borrador no publica." } : result;
}
