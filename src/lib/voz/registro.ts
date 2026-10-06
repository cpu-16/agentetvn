// Llamadas de voz en memoria del proceso de Next. En globalThis para que todas las rutas compartan el mismo mapa
// (cada route.ts se empaqueta aparte). ponytail: un solo proceso; si hubiera varios, pasar a SQLite.
import type { ContextoPantalla, VistaVoz } from "./catalogo";

export type Accion = { tipo: "navegar"; vista: VistaVoz; eventoId?: string } | { tipo: "mostrar"; pregunta: string; respuesta: unknown } | { tipo: "colgada"; motivo: string };
interface Llamada { persona: string; desde: string; contexto: ContextoPantalla | null; acciones: Accion[] }
const g = globalThis as unknown as { __vozLlamadas?: Map<string, Llamada> };
const llamadas = (g.__vozLlamadas ??= new Map<string, Llamada>());

export const abrirLlamada = (hilo: string, persona: string, desde: string) => void llamadas.set(hilo, { persona, desde, contexto: null, acciones: [] });
export const existeLlamada = (hilo: string) => llamadas.has(hilo);
export const esDueno = (hilo: string, persona: string, desde: string) => { const l = llamadas.get(hilo); return !!l && l.persona === persona && l.desde === desde; };
export const guardarContexto = (hilo: string, c: ContextoPantalla) => { const l = llamadas.get(hilo); if (l) l.contexto = c; };
export const contextoDe = (hilo: string) => llamadas.get(hilo)?.contexto ?? null;
export const encolar = (hilo: string, a: Accion) => void llamadas.get(hilo)?.acciones.push(a);
export const sacarAcciones = (hilo: string): Accion[] => { const l = llamadas.get(hilo); if (!l) return []; const a = l.acciones; l.acciones = []; return a; };
export const cerrarLlamada = (hilo: string) => void llamadas.delete(hilo);
export const _vaciarRegistro = () => llamadas.clear();
