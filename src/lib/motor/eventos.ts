// Publicación → evento → procedencia (CU-03, T02, T03).
import { coseno } from "./embeddings";
import { jaccard } from "./bm25";
import { leerScoring } from "./config";
import { idDe, type Noticia, type Procedencia } from "./contrato";

export interface EventoBase {
  id: string;
  representante: string;
  ids_noticia: string[];
  procedencias: Procedencia[];
  fecha_original: string | null;
  no_confiable: boolean;
}

const fechaRef = (n: Noticia) => n.fecha_publicacion ?? n.fecha_deteccion ?? n.fecha_extraccion;
const dias = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
const dominio = (n: Noticia) => n.medio.toLowerCase().replace(/^www\./, "");

/** ¿La noticia pertenece al evento cuyo representante es `rep`? Compara contra el representante, no en cadena. */
export function mismoEvento(n: Noticia, rep: Noticia, vecs: Map<string, Float32Array | number[]>, cfg = leerScoring().N): boolean {
  if (n.fecha_publicacion && rep.fecha_publicacion && dias(n.fecha_publicacion, rep.fecha_publicacion) > cfg.ventana_dias) return false;
  const j = jaccard(n.titulo, rep.titulo);
  if (j >= cfg.jaccard_titular) return true;
  // solapamiento fuerte pero no idéntico (p. ej. «3 muertos» vs «5 muertos» del mismo deslizamiento) y ≤ 3 días
  if (j >= 0.5 && (!n.fecha_publicacion || !rep.fecha_publicacion || dias(n.fecha_publicacion, rep.fecha_publicacion) <= 3)) return true;
  const a = vecs.get(n.id_noticia);
  const b = vecs.get(rep.id_noticia);
  if (!a || !b) return false;
  if (coseno(a, b) < cfg.umbral_mismo_evento) return false;
  // mismo evento semántico solo si además comparten una ventana temporal razonable (si ambas fechas existen ya se verificó)
  return true;
}

/** Procedencias de un conjunto de publicaciones: agencia replicada = una; medios con titular copiado sin atribución = «no verificada». */
export function procedenciasDe(ids: string[], porId: Map<string, Noticia>, cfg = leerScoring().N): Procedencia[] {
  const ns = ids.map((i) => porId.get(i)!).filter(Boolean);
  const out = new Map<string, Procedencia>();
  const agregar = (id: string, tipo: Procedencia["tipo"], nombre: string, n: Noticia) => {
    const p = out.get(id) ?? { id, tipo, nombre, ids_noticia: [] };
    p.ids_noticia.push(n.id_noticia);
    out.set(id, p);
  };
  const sinAgencia: Noticia[] = [];
  for (const n of ns) {
    if (n.agencia) agregar(`agencia:${n.agencia}`, "agencia", n.agencia, n);
    else sinAgencia.push(n); // TVN incluido: pertenecer a un medio no acredita producción independiente
  }
  // Sin atribución: si el titular es (casi) idéntico al de otro medio, no se puede afirmar independencia.
  for (const n of sinAgencia) {
    const copiado = ns.some((m) => m.id_noticia !== n.id_noticia && dominio(m) !== dominio(n) && jaccard(m.titulo, n.titulo) >= cfg.jaccard_titular);
    if (copiado) agregar("no_verificada", "no_verificada", "independencia no verificada", n);
    else agregar(`medio:${n.medio === "TVN" ? "TVN" : dominio(n)}`, "medio", n.medio === "TVN" ? "TVN" : dominio(n), n);
  }
  return [...out.values()];
}

export function agruparEventos(noticias: Noticia[], vecs: Map<string, Float32Array | number[]>, cfg = leerScoring().N): EventoBase[] {
  const porId = new Map(noticias.map((n) => [n.id_noticia, n]));
  const orden = [...noticias].sort((a, b) => fechaRef(a).localeCompare(fechaRef(b)));
  const eventos: { rep: Noticia; ids: string[] }[] = [];
  for (const n of orden) {
    const ev = eventos.find((e) => mismoEvento(n, e.rep, vecs, cfg));
    if (ev) ev.ids.push(n.id_noticia);
    else eventos.push({ rep: n, ids: [n.id_noticia] });
  }
  return eventos.map((e) => {
    const fechas = e.ids.map((i) => porId.get(i)!.fecha_publicacion).filter((f): f is string => !!f).sort();
    return {
      id: idDe("ev", e.rep.url),
      representante: e.rep.id_noticia,
      ids_noticia: e.ids,
      procedencias: procedenciasDe(e.ids, porId, cfg),
      fecha_original: fechas[0] ?? null,
      no_confiable: e.ids.some((i) => porId.get(i)!.no_confiable),
    };
  });
}
