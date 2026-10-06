// Llamadas de voz en memoria del proceso de Next. En globalThis para que todas las rutas compartan el mismo mapa
// (cada route.ts se empaqueta aparte). ponytail: un solo proceso; si hubiera varios, pasar a SQLite.
import type { ContextoPantalla, VistaVoz } from "./catalogo";

export type Accion = { tipo: "navegar"; vista: VistaVoz; eventoId?: string } | { tipo: "desplazar"; direccion: "arriba" | "abajo" | "inicio" | "final" } | { tipo: "atras" } | { tipo: "mostrar"; pregunta: string; respuesta: unknown } | { tipo: "colgada"; motivo: string };
interface Llamada { persona: string; desde: string; contexto: ContextoPantalla | null; acciones: Accion[]; inicio: number; sondeo: number; turnos?: number }
const g = globalThis as unknown as { __vozLlamadas?: Map<string, Llamada> };
const llamadas = (g.__vozLlamadas ??= new Map<string, Llamada>());

/** Una llamada dura a lo sumo 3 min: si se perdió el aviso de fin, a los 10 min se borra sola. */
const barrer = (ahora = Date.now()) => { for (const [h, l] of llamadas) if (ahora - l.inicio > 10 * 60_000) llamadas.delete(h); };
export const abrirLlamada = (hilo: string, persona: string, desde: string) => { barrer(); llamadas.set(hilo, { persona, desde, contexto: null, acciones: [], inicio: Date.now(), sondeo: Date.now() }); };
export const existeLlamada = (hilo: string) => { barrer(); return llamadas.has(hilo); };
export const esDueno = (hilo: string, persona: string, desde: string) => { const l = llamadas.get(hilo); return !!l && l.persona === persona && l.desde === desde; };
export const guardarContexto = (hilo: string, c: ContextoPantalla) => { const l = llamadas.get(hilo); if (l) l.contexto = c; };
export const contextoDe = (hilo: string) => llamadas.get(hilo)?.contexto ?? null;
export const encolar = (hilo: string, a: Accion) => void llamadas.get(hilo)?.acciones.push(a);
export const sacarAcciones = (hilo: string): Accion[] => { const l = llamadas.get(hilo); if (!l) return []; l.sondeo = Date.now(); const a = l.acciones; l.acciones = []; return a; };
/** La página consulta acciones cada segundo; si lleva más de 15 s sin hacerlo (cerró la pestaña, se cayó el navegador), está abandonada. */
export const abandonada = (hilo: string, ahora = Date.now()) => { const l = llamadas.get(hilo); return !!l && ahora - l.sondeo > 15_000; };
/** Tope de turnos registrados por llamada (una llamada de 3 min no pasa de unas decenas). */
export const contarTurno = (hilo: string, max = 120) => { const l = llamadas.get(hilo); if (!l) return false; l.turnos = (l.turnos ?? 0) + 1; return l.turnos <= max; };
export const cerrarLlamada = (hilo: string) => void llamadas.delete(hilo);
export const _vaciarRegistro = () => llamadas.clear();
