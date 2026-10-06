import type { Tablero, EventoTablero } from "@/lib/motor/tablero";

export type { Tablero, EventoTablero };
export interface Filtro { temas: string[]; rango: ("bajo" | "medio" | "alto")[]; desde?: string; hasta?: string; medio?: string }
export const FILTRO_VACIO: Filtro = { temas: [], rango: [] };

/** Aplica el filtro compartido a la lista de eventos. */
export function filtrarEventos(eventos: EventoTablero[], f: Filtro): EventoTablero[] {
  return eventos.filter((e) => {
    if (f.temas.length && !f.temas.includes(e.tema)) return false;
    if (f.rango.length && !f.rango.includes(e.rango)) return false;
    if (f.medio && e.medio !== f.medio) return false;
    if ((f.desde || f.hasta) && e.fecha) {
      const d = e.fecha.slice(0, 10);
      if (f.desde && d < f.desde) return false;
      if (f.hasta && d > f.hasta) return false;
    } else if ((f.desde || f.hasta) && !e.fecha) return false;
    return true;
  });
}
export const hayFiltro = (f: Filtro) => f.temas.length > 0 || f.rango.length > 0 || !!f.desde || !!f.hasta || !!f.medio;
