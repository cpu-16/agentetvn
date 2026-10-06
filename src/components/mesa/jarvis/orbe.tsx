"use client";
import type { CSSProperties } from "react";
export type EstadoOrbe = "reposo" | "escuchando" | "pensando" | "hablando" | "no_disponible";
export const ETIQUETA_ORBE: Record<EstadoOrbe, string> = { reposo: "Jarvis en espera", escuchando: "Te escucho", pensando: "Pensando", hablando: "Jarvis está hablando", no_disponible: "Voz no disponible" };
/** Orbe azul TVN. «nivel» (0–1) agranda el halo mientras escucha; las ondas marcan el estado. Solo transform y opacity. */
export function Orbe({ estado, nivel = 0 }: { estado: EstadoOrbe; nivel?: number }) {
  return (
    <span className="orbe" data-estado={estado} style={{ "--nivel": Math.min(1, Math.max(0, nivel)) } as CSSProperties} aria-hidden>
      <span className="orbe-onda" /><span className="orbe-onda" /><span className="orbe-onda" /><span className="orbe-esfera" />
    </span>
  );
}
