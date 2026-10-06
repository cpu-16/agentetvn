"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Componentes { R: number; I: number; U: number; N: number; E: number; explicacion: Record<"R" | "I" | "U" | "N" | "E", string> }
export const PESOS = { R: 30, I: 25, U: 20, N: 15, E: 10 } as const;
export const NOMBRE = { R: "Relevancia", I: "Impacto", U: "Urgencia", N: "Novedad", E: "Evidencia" } as const;
export const tramosDe = (componentes: Componentes) => (["R", "I", "U", "N", "E"] as const).map((k) => ({ k, pts: Math.round(PESOS[k] * componentes[k] * 100) / 100 }));

/** Desglose textual del puntaje (reutilizable fuera del medidor: filas de agenda, tarjetas). */
export function Desglose({ componentes, className }: { componentes: Componentes; className?: string }) {
  return (
    <ul className={cn("space-y-1 text-xs", className)}>
      {tramosDe(componentes).map((t) => (
        <li key={t.k}>
          <span className="font-semibold">{NOMBRE[t.k]}</span> {componentes[t.k].toFixed(2)} × {PESOS[t.k]} = {t.pts}. {componentes.explicacion[t.k]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Vúmetro de P: cada tramo mide peso × componente sobre 100. Las barras crecen (spring, sin rebote) una vez al entrar en pantalla.
 * `tooltip` solo cuando el medidor NO vive dentro de otro control (un trigger anidado en un botón rompe el teclado).
 */
export function Medidor({ P, rango, componentes, grande = false, conDetalle = false, tooltip = false }: { P: number; rango: "bajo" | "medio" | "alto"; componentes: Componentes; grande?: boolean; conDetalle?: boolean; tooltip?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { once: true, margin: "-20px" });
  const reducir = useReducedMotion();
  const tramos = tramosDe(componentes);
  const etiqueta = `Puntaje ${P} de 100, ${rango}: ${tramos.map((t) => `${NOMBRE[t.k]} ${t.pts}`).join(", ")}`;
  const barra = (
    <div ref={ref} className={cn("vumetro", rango, grande && "h-4")} role="img" aria-label={etiqueta}>
      {tramos.map((t, i) => (
        <motion.span
          key={t.k}
          className={t.k.toLowerCase()}
          style={{ width: `${t.pts}%`, transformOrigin: "left center" }}
          initial={reducir ? { opacity: 0 } : { transform: "scaleX(0)" }}
          animate={enVista ? { opacity: 1, transform: "scaleX(1)" } : undefined}
          transition={{ type: "spring", bounce: 0, duration: 0.5, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className={cn("titular font-semibold leading-none", grande ? "text-4xl" : "text-xl", rango === "alto" && "text-azul")}>{P.toFixed(grande ? 2 : 0)}</span>
        <span className="text-xs text-muted-foreground">{rango}</span>
      </div>
      {tooltip && !conDetalle ? (
        <Tooltip>
          <TooltipTrigger asChild>{barra}</TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm text-xs"><Desglose componentes={componentes} /></TooltipContent>
        </Tooltip>
      ) : (
        barra
      )}
      {conDetalle && (
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {tramos.map((t) => (
            <div key={t.k} className="rounded-sm bg-white px-3 py-2">
              <dt className="flex items-baseline justify-between">
                <span className="font-medium">{NOMBRE[t.k]}</span>
                <span className="text-muted-foreground">{componentes[t.k].toFixed(2)} × {PESOS[t.k]} = {t.pts}</span>
              </dt>
              <dd className="mt-1 text-muted-foreground">{componentes.explicacion[t.k]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
