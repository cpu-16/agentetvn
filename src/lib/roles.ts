// Qué le toca a cada rol de la mesa (reto §2: editor/a y periodista → agenda, ficha de investigación, preguntas
// pendientes y borradores; productor/a digital → titulares, resumen web y copy social; analista bancario → boletín de
// entorno con señales sectoriales y preguntas de seguimiento). Un solo filtro para la portada,
// el chat y Jarvis: los tres dicen lo mismo. Sin imports de servidor.
export type RolMesa = "editor" | "periodista" | "productor" | "analista";

/** Lo que el filtro necesita de un evento de la agenda (el resumen de /api/agenda lo trae completo). */
export interface EventoMesa {
  id: string; titulo: string; P: number; rango: string; estado_evidencia: string; estado_revision: string; tema?: string; por_revisar?: boolean;
  contradicciones: unknown[]; no_confiable: boolean; sintetica?: boolean; revisable?: boolean; // revisable: la regla de «Cinco para hoy»
}

export const MESA: Record<RolMesa, { titulo: string; bajada: string; accion: string; pestana: "evidencia" | "paquete"; vacio: string }> = {
  editor: { titulo: "Tu cola de decisión", bajada: "Decides qué se cubre hoy: revisas la evidencia, tomas el tema, pides evidencia al periodista o descartas, y apruebas el borrador. Aprobar no publica.", accion: "Decidir", pestana: "evidencia", vacio: "No queda nada por decidir en el corte." },
  periodista: { titulo: "Qué falta verificar", bajada: "Verificas antes de que se escriba: temas importantes con evidencia insuficiente o parcial, versiones que no coinciden y lo que el editor te devolvió.", accion: "Verificar", pestana: "evidencia", vacio: "Nada pendiente de verificar en el corte." },
  productor: { titulo: "Listos para armar la pieza", bajada: "Preparas el paquete para TV, web y redes: propuestas de titular, resumen web, guion de 45 a 60 segundos y copy, cada frase con su cita. Cuando la dejas armada, marcas «Pieza lista» y sale de tu cola.", accion: "Armar la pieza", pestana: "paquete", vacio: "Todavía no hay temas con evidencia para armar." },
  analista: { titulo: "Señales para el boletín de entorno", bajada: "Lees la agenda con lente de banca: temas de economía, logística y Canal, turismo y regulación, ordenados por el mismo puntaje de atención. Para cada uno armas un boletín de entorno con sectores, horizonte y preguntas de seguimiento, cada frase con su cita.", accion: "Armar boletín", pestana: "paquete", vacio: "No hay temas económicos en el corte." },
};

/** Acción sugerida para un tema según su evidencia (la misma que muestra la ficha). */
export function accionSugerida(e: EventoMesa): string {
  if (e.no_confiable) return "Contenido marcado como no confiable: no se usa en el borrador.";
  if (e.contradicciones.length) return "Resolver la contradicción con una fuente primaria antes de redactar.";
  if (e.estado_evidencia === "insuficiente") return e.rango === "alto" ? "Investigar: prioridad alta con evidencia insuficiente." : "Monitorear: evidencia insuficiente.";
  if (e.estado_evidencia === "parcial") return "Borrador con lo citado; completar verificaciones antes de aprobar.";
  return "Evidencia suficiente para el borrador.";
}

const ORDEN: Record<RolMesa, Record<string, number>> = {
  editor: { en_revision: 0, nuevo: 1 }, // primero lo que espera su aprobación
  periodista: { requiere_evidencia: 0, en_revision: 1, nuevo: 2 }, // primero lo que el editor le devolvió
  productor: { aprobado_borrador: 0, en_revision: 1, nuevo: 2 }, // primero lo que el editor ya aprobó para adaptar a formatos; «pieza lista» sale
  analista: { nuevo: 0, en_revision: 0, requiere_evidencia: 0, aprobado_borrador: 0, pieza_lista: 0 }, // su revisión (la del boletín) es aparte: manda el puntaje
};
/** Temas con peso económico para el analista bancario. ponytail: por tema del motor, no un puntaje económico propio; uno propio si la banca lo pide. */
export const TEMAS_BANCA = ["economia", "logistica_canal", "turismo", "regulacion"];

/** Los temas que le tocan hoy a un rol, en el orden en que conviene atenderlos (máx. `max`). */
export function tocaA(rol: RolMesa, eventos: EventoMesa[], max = 5): EventoMesa[] {
  const orden = ORDEN[rol];
  const entra = (e: EventoMesa) => {
    if (e.sintetica || e.no_confiable || e.revisable === false || !(e.estado_revision in orden)) return false;
    if (rol === "periodista") return e.estado_revision === "requiere_evidencia" || e.estado_evidencia !== "suficiente" || e.contradicciones.length > 0;
    if (rol === "productor") return e.estado_evidencia !== "insuficiente" && !e.contradicciones.length; // con qué escribir y sin versiones en disputa
    if (rol === "analista") return TEMAS_BANCA.includes(e.tema ?? "") && !e.por_revisar; // tema dudoso del clasificador: no entra a la banca
    return true;
  };
  return eventos.filter(entra).sort((a, b) => orden[a.estado_revision] - orden[b.estado_revision] || b.P - a.P).slice(0, max);
}

/** Cifras de la mesa del rol (lo que se ve arriba del listado). */
export function cuentasMesa(rol: RolMesa, eventos: EventoMesa[]): { n: number; etiqueta: string }[] {
  const reales = eventos.filter((e) => !e.sintetica && !e.no_confiable);
  const c = (f: (e: EventoMesa) => boolean) => reales.filter(f).length;
  if (rol === "editor") return [{ n: c((e) => e.estado_revision === "nuevo" && e.rango === "alto"), etiqueta: "de prioridad alta sin decidir" }, { n: c((e) => e.estado_revision === "en_revision"), etiqueta: "esperan tu aprobación" }, { n: c((e) => e.estado_revision === "aprobado_borrador"), etiqueta: "aprobados como borrador" }];
  if (rol === "periodista") return [{ n: c((e) => e.rango === "alto" && e.estado_evidencia !== "suficiente"), etiqueta: "de prioridad alta sin evidencia suficiente" }, { n: c((e) => e.contradicciones.length > 0), etiqueta: "con versiones que no coinciden" }, { n: c((e) => e.estado_revision === "requiere_evidencia"), etiqueta: "te pidió evidencia el editor" }];
  if (rol === "analista") { const eco = (e: EventoMesa) => TEMAS_BANCA.includes(e.tema ?? "") && !e.por_revisar; return [{ n: c(eco), etiqueta: "temas económicos en el corte" }, { n: c((e) => eco(e) && e.rango === "alto"), etiqueta: "de prioridad alta" }, { n: c((e) => eco(e) && e.estado_evidencia === "suficiente"), etiqueta: "con evidencia suficiente" }]; }
  return [{ n: c((e) => e.estado_evidencia === "suficiente"), etiqueta: "con evidencia suficiente" }, { n: c((e) => e.estado_revision === "aprobado_borrador"), etiqueta: "aprobados, por armar" }, { n: c((e) => e.estado_revision === "pieza_lista"), etiqueta: "piezas listas" }];
}

export const esRol = (r: unknown): r is RolMesa => r === "editor" || r === "periodista" || r === "productor" || r === "analista";
