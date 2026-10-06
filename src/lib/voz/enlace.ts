// Enlace inverso con el puente de voz. El puente corre en css-llamada (otra red, sin entrada): pregunta por comandos con
// long-poll y contesta por id. Todo en memoria del proceso de Next, en globalThis (cada route.ts se empaqueta aparte).
import { randomUUID } from "crypto";
import { abrirLlamada, existeLlamada } from "./registro";

export type Comando = { tipo: "offer"; id: string; sdp: string; persona: string } | { tipo: "colgar"; hilo: string; motivo: string };
export type RespuestaOferta = { ok: true; sdp: string; hilo: string } | { ok: false; status: number; error: string };
interface Enlace { cola: Comando[]; esperando: ((c: Comando | null) => void)[]; respuestas: Map<string, (r: RespuestaOferta) => void>; visto: number; estado: { ocupada: boolean; seg_hora: number; activa?: string } }

const g = globalThis as unknown as { __vozEnlace?: Enlace };
const nuevo = (): Enlace => ({ cola: [], esperando: [], respuestas: new Map(), visto: 0, estado: { ocupada: false, seg_hora: 0 } });
const e = () => (g.__vozEnlace ??= nuevo());

/** El puente está vivo si consultó en los últimos 40 s (su long-poll dura ≤ 25 s). */
export const puenteVivo = (ahora = Date.now()) => ahora - e().visto < 40_000;
export const estadoPuente = () => ({ vivo: puenteVivo(), ...e().estado });

function entregar(c: Comando) {
  const w = e().esperando.shift();
  if (w) w(c);
  else e().cola.push(c);
}

/** ¿Hay una oferta esperando respuesta? Solo se admite una a la vez (el puente atiende una llamada a la vez). */
export const ofertaPendiente = () => e().respuestas.size > 0;

/** Pide al puente que abra una llamada. Al aceptar, la registra a nombre de la sesión en el mismo paso (sin ventana en la
 *  que el puente reporte una llamada que Next no conoce). 503 si no contesta en el plazo. */
export function pedirOferta(sdp: string, persona: string, desde: string, timeoutMs = Number(process.env.VOZ_OFERTA_MS ?? 30_000)): Promise<RespuestaOferta> {
  const id = randomUUID();
  return new Promise((resolve) => {
    const t = setTimeout(() => { e().respuestas.delete(id); e().cola = e().cola.filter((c) => !(c.tipo === "offer" && c.id === id)); resolve({ ok: false, status: 503, error: "el puente no respondió" }); }, timeoutMs);
    e().respuestas.set(id, (r) => { clearTimeout(t); e().respuestas.delete(id); if (r.ok) abrirLlamada(r.hilo, persona, desde); resolve(r); });
    entregar({ tipo: "offer", id, sdp, persona });
  });
}

export const pedirColgar = (hilo: string, motivo: string) => entregar({ tipo: "colgar", hilo, motivo });

/** Long-poll del puente: el siguiente comando, o null tras `ms`. De paso registra que está vivo y su estado.
 *  Reconciliación: si el puente tiene una llamada que Next no conoce (Next se reinició, se perdió un «colgar»), se le
 *  ordena colgarla, salvo que haya una oferta en curso. */
export function esperarComando(estado: { ocupada: boolean; seg_hora: number; activa?: string }, ms = 25_000): Promise<Comando | null> {
  const en = e();
  en.visto = Date.now();
  en.estado = estado;
  if (estado.activa && !existeLlamada(estado.activa) && !ofertaPendiente()) return Promise.resolve({ tipo: "colgar", hilo: estado.activa, motivo: "Next no reconoce la llamada" });
  const c = en.cola.shift();
  if (c) return Promise.resolve(c);
  return new Promise((resolve) => {
    const w = (x: Comando | null) => { clearTimeout(t); resolve(x); };
    const t = setTimeout(() => { en.esperando = en.esperando.filter((f) => f !== w); resolve(null); }, ms);
    en.esperando.push(w);
  });
}

/** true si alguien esperaba esa respuesta; si no (llegó tarde), el puente debe colgar la llamada. */
export function recibirRespuesta(id: string, r: RespuestaOferta): boolean {
  const f = e().respuestas.get(id);
  if (!f) return false;
  f(r);
  return true;
}
export const _vaciarEnlace = () => { g.__vozEnlace = nuevo(); };
