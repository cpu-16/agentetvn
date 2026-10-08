// Contradicciones (T05) y estado de evidencia (independiente del puntaje).
import type { Contradiccion, EstadoEvidencia, Evento, Noticia, Procedencia } from "./contrato";
import { leerScoring } from "./config";

const CIFRA = /(\d+(?:[.,]\d+)?)\s*(%|por ciento|millones|mil|muertos|fallecidos|heridos|personas|casos|buques|días|horas|dólares|balboas|kil[oó]metros|km)/gi;

export function cifrasDe(texto: string, campo = "titulo"): { valor: number; unidad: string; campo: string }[] {
  const out: { valor: number; unidad: string; campo: string }[] = [];
  for (const m of texto.matchAll(CIFRA)) out.push({ valor: Number(m[1].replace(",", ".")), unidad: m[2].toLowerCase().replace("por ciento", "%").replace("fallecidos", "muertos").replace("kilómetros", "km").replace("kilometros", "km"), campo });
  return out;
}

/** Dos publicaciones del mismo evento con cifras distintas para la misma unidad → contradicción visible; no se resuelve sola. */
export function detectarContradicciones(publicaciones: Noticia[]): Contradiccion[] {
  const out: Contradiccion[] = [];
  const cifras = publicaciones.map((n) => ({ n, c: [...cifrasDe(n.titulo, "titulo"), ...cifrasDe(n.descripcion, "descripcion")] }));
  for (let i = 0; i < cifras.length; i++)
    for (let j = i + 1; j < cifras.length; j++) {
      // copias idénticas no se contradicen entre sí (sus cifras internas distintas describen hechos distintos)
      if (`${cifras[i].n.titulo} ${cifras[i].n.descripcion}`.trim() === `${cifras[j].n.titulo} ${cifras[j].n.descripcion}`.trim()) continue;
      for (const a of cifras[i].c)
        for (const b of cifras[j].c) {
          if (a.unidad !== b.unidad || a.valor === b.valor) continue;
          // si ambas publicaciones también comparten esa misma cifra, no es contradicción sino dos datos distintos
          const comparte = cifras[j].c.some((x) => x.unidad === a.unidad && x.valor === a.valor) || cifras[i].c.some((x) => x.unidad === b.unidad && x.valor === b.valor);
          if (comparte) continue;
          out.push({ a: cifras[i].n.id_noticia, b: cifras[j].n.id_noticia, campo: a.campo === b.campo ? a.campo : `${a.campo}/${b.campo}`, detalle: `«${a.valor} ${a.unidad}» (${cifras[i].n.medio}, ${a.campo}) vs «${b.valor} ${b.unidad}» (${cifras[j].n.medio}, ${b.campo})` });
        }
    }
  return out;
}

/** Palabras de contenido (≥ 4 letras) que un extracto debe aportar más allá de su titular para contar como material atribuible. */
export const EXTRACTO_MIN_PALABRAS = 5;
const palabrasDe = (s: string) => new Set(s.toLowerCase().match(/\p{L}{4,}/gu) ?? []);

/** ¿La bajada dice algo que el titular no dice? Varios RSS repiten el titular con autor y fecha (p. ej. «… mmontenegro Mar, 06/10/2026»): eso no es extracto. */
export function aportaExtracto(titulo: string, descripcion: string): boolean {
  const delTitular = palabrasDe(titulo);
  return [...palabrasDe(descripcion)].filter((w) => !delTitular.has(w)).length >= EXTRACTO_MIN_PALABRAS;
}

/**
 * Regla de evidencia v2 (D20, 7-oct-2026): el estado dice qué permite sostener el material, no si la noticia es verdadera.
 * - suficiente para el borrador: fuente primaria del hecho o ≥ 2 procedencias independientes, con URL y fecha, sin contradicción;
 * - parcial: una procedencia con extracto que aporta algo más que el titular (borrador limitado y atribuido), versiones en disputa con respaldo, o respaldo sin URL/fecha;
 * - insuficiente: solo el titular de una procedencia, o versiones en disputa sin respaldo. Pide investigar; nunca habilita publicar.
 * La v1 exigía fuente primaria (gob.pa/USGS) para todo verde y dejaba en rojo la cobertura propia de TVN con extracto.
 */
export function estadoEvidencia(E: number, procedencias: Procedencia[], hayPrimaria: boolean, contradicciones: Contradiccion[], hayExtracto: boolean, cfg = leerScoring().E, identificable = true): EstadoEvidencia {
  const M = procedencias.filter((p) => p.tipo !== "no_verificada").length;
  const respaldo = hayPrimaria || M >= 2;
  if (contradicciones.length) return respaldo ? "parcial" : "insuficiente";
  // el verde exige URL y fecha de todas las publicaciones de forma explícita: E ≥ umbral no lo garantiza (primaria sola ya da 0.45)
  if (respaldo) return identificable && E >= cfg.umbral_insuficiente ? "suficiente" : "parcial";
  return M === 1 && hayExtracto ? "parcial" : "insuficiente";
}

/** Qué falta verificar según el estado de evidencia (la misma regla, en palabras del periodista; corto porque la voz lee 40 palabras). Vacío si hay fuente primaria sin disputa. */
export function faltaPorEvidencia(ev: Pick<Evento, "estado_evidencia" | "procedencias" | "contradicciones" | "primaria">): string[] {
  const indep = ev.procedencias.filter((p) => p.tipo !== "no_verificada");
  const quien = indep.length === 1 ? indep[0].nombre : "una procedencia";
  if (ev.estado_evidencia === "insuficiente")
    return [ev.contradicciones.length
      ? "Evidencia insuficiente: versiones que no coinciden y sin otra fuente; no afirmar cifras."
      : indep.length
        ? `Evidencia insuficiente: solo el titular de ${quien}; falta otra fuente independiente o la primaria.`
        : "Evidencia insuficiente: titulares copiados sin procedencia independiente; falta una fuente propia o la primaria."];
  if (ev.estado_evidencia === "parcial") {
    if (ev.contradicciones.length) return ["Evidencia parcial: las versiones no coinciden; mostrar ambas y verificar con la primaria."];
    if (indep.length === 1 && !ev.primaria) return [`Evidencia parcial: solo ${quien}, con extracto; atribuirle cada dato y buscar otra fuente.`];
    return ["Evidencia parcial: falta URL o fecha de alguna publicación."];
  }
  return ev.primaria ? [] : [`Evidencia suficiente: ${indep.length} procedencias sin primaria; confirmar que no repiten el mismo cable.`];
}

/** Plantillas exactas que escribe el motor (v1 y v2). Solo esas se reemplazan: una verificación escrita por una persona o por la IA se conserva aunque empiece igual. */
const PLANTILLAS_EVIDENCIA = [
  /^Evidencia (insuficiente|parcial): conseguir fuente primaria antes de afirmar el hecho\.$/, // v1
  /^Evidencia insuficiente: solo el titular de [^;]+; falta otra fuente independiente o la primaria\.$/,
  /^Evidencia insuficiente: titulares copiados sin procedencia independiente; falta una fuente propia o la primaria\.$/,
  /^Evidencia insuficiente: versiones que no coinciden y sin otra fuente; no afirmar cifras\.$/,
  /^Evidencia parcial: las versiones no coinciden; mostrar ambas y verificar con la primaria\.$/,
  /^Evidencia parcial: solo [^,]+, con extracto; atribuirle cada dato y buscar otra fuente\.$/,
  /^Evidencia parcial: falta URL o fecha de alguna publicación\.$/,
  /^Evidencia suficiente: \d+ procedencias sin primaria; confirmar que no repiten el mismo cable\.$/,
];
export const esPlantillaEvidencia = (v: string) => PLANTILLAS_EVIDENCIA.some((r) => r.test(v));

/** Un paquete guardado conserva su redacción y lo que escribió una persona; solo la línea automática de evidencia se recalcula con la regla vigente. */
export function conEvidenciaVigente<T extends { verificaciones: string[] }>(p: T, ev: Parameters<typeof faltaPorEvidencia>[0]): T {
  return { ...p, verificaciones: [...faltaPorEvidencia(ev), ...p.verificaciones.filter((v) => !esPlantillaEvidencia(v))] };
}
