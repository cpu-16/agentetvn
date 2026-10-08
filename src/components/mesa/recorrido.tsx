"use client";
// Dónde va el tema en el flujo de la mesa y a quién le toca ahora (lo pidió el editor del equipo: «una línea para ver dónde está en el flow»).
import { ROLES } from "@/store/mesa";
import { cn } from "@/lib/utils";

const PASOS = [
  { id: "nuevo", label: "Nuevo", quien: "editor" },
  { id: "en_revision", label: "En revisión", quien: "editor" },
  { id: "aprobado_borrador", label: "Aprobado como borrador", quien: "productor" },
  { id: "pieza_lista", label: "Pieza lista", quien: null },
] as const;
// pedir evidencia es un desvío del paso «En revisión»: vuelve al editor cuando el periodista termina
const PASO_DE: Record<string, number> = { nuevo: 0, en_revision: 1, requiere_evidencia: 1, aprobado_borrador: 2, pieza_lista: 3 };

/** A quién le toca el tema en ese estado (null: nadie, el flujo terminó o se descartó). */
export const turnoDe = (estado: string): string | null =>
  estado === "requiere_evidencia" ? "periodista" : estado === "descartado" || estado === "pieza_lista" ? null : estado === "aprobado_borrador" ? "productor" : "editor";
export const nombreRol = (rol: string) => ROLES.find((r) => r.id === rol)?.label ?? rol;

export function Recorrido({ estado, rol }: { estado: string; rol: string }) {
  const actual = PASO_DE[estado] ?? -1;
  const turno = turnoDe(estado);
  const nota = estado === "descartado" ? "Descartado: salió del flujo. El editor puede reabrirlo."
    : estado === "requiere_evidencia" ? `El editor pidió evidencia: ${turno === rol ? "te toca buscarla y devolvérsela" : "la busca el periodista y se la devuelve"}.`
    : estado === "pieza_lista" ? "Pieza armada. Publicar se hace fuera de AgenteTVN, por una persona."
    : turno === rol ? "Te toca a ti." : `Le toca a: ${nombreRol(turno ?? "")}.`;
  return (
    <nav aria-label="Recorrido del tema en la mesa" data-guia="ficha-recorrido" className="mt-4 rounded-sm border border-border bg-white px-3 py-2.5">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {PASOS.map((p, i) => {
          const hecho = actual > i || estado === "pieza_lista";
          const aqui = actual === i && estado !== "pieza_lista";
          return (
            <li key={p.id} className="flex items-center gap-1" aria-current={aqui ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={cn("h-px w-4 sm:w-8", actual >= i ? "bg-tinta" : "bg-border")} />}
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", aqui ? "border-azul bg-azul font-medium text-white" : hecho ? "border-tinta text-tinta" : "border-border text-muted-foreground", estado === "descartado" && "opacity-60")}>
                <span aria-hidden className="tabular-nums">{hecho ? "✓" : i + 1}</span>
                {aqui && estado === "requiere_evidencia" ? "Evidencia pedida" : p.label}
                {p.quien && <span className={cn("hidden sm:inline", aqui ? "text-white/80" : "text-muted-foreground")}>· {nombreRol(estado === "requiere_evidencia" && aqui ? "periodista" : p.quien)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={cn("mt-1.5 text-xs", turno === rol ? "font-medium text-azul" : "text-muted-foreground")}>{nota}</p>
    </nav>
  );
}
