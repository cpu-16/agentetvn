export type EstadoVoz = "inactiva" | "conectando" | "lista" | "escuchando" | "pensando" | "hablando" | "no_disponible";
export type EventoVoz = { tipo: "conectar" | "conectada" | "pulsar" | "soltar" | "fallo" | "colgar" } | { tipo: "turno_creado" | "turno_hecho"; rol: "user" | "assistant" };

export function siguiente(e: EstadoVoz, ev: EventoVoz): EstadoVoz {
  switch (ev.tipo) {
    case "conectar": return "conectando";
    case "conectada": return "lista";
    case "fallo": return "no_disponible";
    case "colgar": return "inactiva";
    case "pulsar": return e === "lista" || e === "hablando" || e === "pensando" ? "escuchando" : e;
    case "soltar": return e === "escuchando" ? "pensando" : e;
    case "turno_creado": return ev.rol === "assistant" ? "hablando" : e;
    case "turno_hecho": return ev.rol === "assistant" && e === "hablando" ? "lista" : e;
  }
}
export function estadoOrbe(e: EstadoVoz): "reposo" | "escuchando" | "pensando" | "hablando" | "no_disponible" {
  return e === "escuchando" || e === "hablando" || e === "no_disponible" ? e : e === "pensando" || e === "conectando" ? "pensando" : "reposo";
}
/** Motivo para colgar, o null. «enCurso» = alguien habla o corre una herramienta: el silencio no cuenta. */
export function debeColgar(s: { oculta: boolean; sesionVencida: boolean; msSinActividad: number; enCurso: boolean }): string | null {
  if (s.oculta) return "la pantalla se ocultó";
  if (s.sesionVencida) return "venció la sesión";
  if (!s.enCurso && s.msSinActividad >= 20_000) return "20 s de silencio";
  return null;
}
