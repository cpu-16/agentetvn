// Revisión humana · transiciones válidas y motivo obligatorio. Aprobar como borrador NUNCA publica.
import { ESTADOS_REVISION, type EstadoRevision } from "./contrato";

export const TRANSICIONES: Record<EstadoRevision, EstadoRevision[]> = {
  nuevo: ["en_revision", "descartado"],
  en_revision: ["requiere_evidencia", "aprobado_borrador", "descartado"],
  requiere_evidencia: ["en_revision", "descartado"],
  aprobado_borrador: ["en_revision", "pieza_lista"], // reabrir o el productor deja la pieza armada
  pieza_lista: ["en_revision"], // reabrir
  descartado: ["en_revision"], // reabrir
};
export const EXIGE_MOTIVO: EstadoRevision[] = ["requiere_evidencia", "descartado"];

export function validarTransicion(actual: EstadoRevision, nuevo: EstadoRevision, motivo?: string | null): { ok: true } | { ok: false; status: 400 | 409; error: string } {
  if (!ESTADOS_REVISION.includes(nuevo)) return { ok: false, status: 400, error: `estado inválido: ${nuevo}` };
  if (!TRANSICIONES[actual].includes(nuevo)) return { ok: false, status: 409, error: `transición no permitida: ${actual} → ${nuevo}` };
  if (EXIGE_MOTIVO.includes(nuevo) && !motivo?.trim()) return { ok: false, status: 400, error: `${nuevo} exige motivo` };
  return { ok: true };
}
