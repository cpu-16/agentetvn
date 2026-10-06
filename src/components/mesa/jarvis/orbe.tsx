"use client";
import type { CSSProperties } from "react";
export type EstadoOrbe = "reposo" | "escuchando" | "pensando" | "hablando" | "no_disponible";
export const ETIQUETA_ORBE: Record<EstadoOrbe, string> = { reposo: "Jarvis en espera", escuchando: "Te escucho", pensando: "Consultando las fuentes", hablando: "Jarvis está hablando", no_disponible: "Voz no disponible" };
/** Orbe azul TVN. «nivel» (0–1) agranda el anillo mientras escucha. Solo transform y opacity. */
export function Orbe({ estado, nivel = 0 }: { estado: EstadoOrbe; nivel?: number }) {
  return <span className="orbe" data-estado={estado} style={{ "--nivel": Math.min(1, Math.max(0, nivel)) } as CSSProperties} aria-hidden />;
}
