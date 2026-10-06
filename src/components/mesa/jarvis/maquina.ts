// Conversación continua: un toque abre la llamada con el micrófono abierto; el turno lo decide la detección de voz del modelo.
export type EstadoVoz = "inactiva" | "conectando" | "escuchando" | "pensando" | "hablando" | "no_disponible";
export type EventoVoz = { tipo: "conectar" | "conectada" | "fallo" | "colgar" } | { tipo: "turno_creado" | "turno_hecho"; rol: "user" | "assistant" };

export function siguiente(e: EstadoVoz, ev: EventoVoz): EstadoVoz {
  switch (ev.tipo) {
    case "conectar": return "conectando";
    case "conectada": return "escuchando";
    case "fallo": return "no_disponible";
    case "colgar": return "inactiva";
    case "turno_creado": return ev.rol === "assistant" ? "hablando" : e === "inactiva" || e === "no_disponible" ? e : "escuchando";
    case "turno_hecho": return e === "inactiva" || e === "no_disponible" ? e : ev.rol === "user" ? "pensando" : "escuchando";
  }
}
export const vozActiva = (e: EstadoVoz) => e !== "inactiva" && e !== "no_disponible";
export function estadoOrbe(e: EstadoVoz): "reposo" | "escuchando" | "pensando" | "hablando" | "no_disponible" {
  return e === "escuchando" || e === "hablando" || e === "no_disponible" || e === "pensando" ? e : e === "conectando" ? "pensando" : "reposo";
}
export const SILENCIO_MS = 60_000;
export const SIN_RESPUESTA_MS = 45_000;
/** Motivo para colgar, o null. «enCurso» = Jarvis piensa o habla: ese silencio no cuenta, pero si pasa 45 s sin ningún evento
 *  (la respuesta nunca llegó) también cuelga, para no gastar el cupo compartido. */
export function debeColgar(s: { oculta: boolean; sesionVencida: boolean; msSinActividad: number; enCurso: boolean }): string | null {
  if (s.oculta) return "saliste de esta pantalla";
  if (s.sesionVencida) return "venció la sesión";
  if (s.enCurso && s.msSinActividad >= SIN_RESPUESTA_MS) return "no me llegó la respuesta a tiempo";
  if (!s.enCurso && s.msSinActividad >= SILENCIO_MS) return "pasó un minuto sin conversación";
  return null;
}
