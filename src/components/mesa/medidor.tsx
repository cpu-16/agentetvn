"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Componentes { R: number; I: number; U: number; N: number; E: number; explicacion: Record<"R" | "I" | "U" | "N" | "E", string> }
const PESOS = { R: 30, I: 25, U: 20, N: 15, E: 10 } as const;
const NOMBRE = { R: "Relevancia", I: "Impacto", U: "Urgencia", N: "Novedad", E: "Evidencia" } as const;

/** Vúmetro de P: cada tramo mide peso × componente sobre 100. */
export function Medidor({ P, rango, componentes, grande = false, conDetalle = false }: { P: number; rango: "bajo" | "medio" | "alto"; componentes: Componentes; grande?: boolean; conDetalle?: boolean }) {
  const tramos = (["R", "I", "U", "N", "E"] as const).map((k) => ({ k, pts: Math.round(PESOS[k] * componentes[k] * 100) / 100 }));
  const barra = (
    <div className={cn("vumetro", rango, grande && "h-4")} role="img" aria-label={`Puntaje ${P} de 100, ${rango}`}>
      {tramos.map((t) => (
        <span key={t.k} className={t.k.toLowerCase()} style={{ width: `${t.pts}%` }} />
      ))}
    </div>
  );
  return (
    <div className={cn("flex flex-col gap-1", grande ? "w-full" : "w-full")}>
      <div className="flex items-baseline gap-2">
        <span className={cn("titular font-semibold leading-none", grande ? "text-4xl" : "text-xl", rango === "alto" && "text-senal")}>{P.toFixed(grande ? 2 : 0)}</span>
        <span className="text-xs text-muted-foreground">{rango}</span>
      </div>
      {conDetalle ? (
        barra
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{barra}</TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm text-xs">
            <ul className="space-y-1">
              {tramos.map((t) => (
                <li key={t.k}>
                  <span className="font-semibold">{NOMBRE[t.k]}</span> {componentes[t.k].toFixed(2)} × {PESOS[t.k]} = {t.pts}. {componentes.explicacion[t.k]}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
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
