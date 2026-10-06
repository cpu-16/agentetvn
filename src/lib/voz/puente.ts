// Acceso a la voz: interruptor, motivo y token interno del puente (llega por Cloudflare: el token es la única llave).
import { timingSafeEqual } from "crypto";

export const vozActiva = () => process.env.AGENTETVN_VOZ === "on" && process.env.AGENTETVN_MODO === "online" && (process.env.VOZ_TOKEN ?? "").length >= 16;
export const motivoInactiva = () => (process.env.AGENTETVN_VOZ !== "on" ? "La voz está apagada en esta demo." : process.env.AGENTETVN_MODO !== "online" ? "Modo sin internet: la voz no está disponible." : "La voz no está configurada.");

/** Token interno en tiempo constante (≥ 16 caracteres). */
export function tokenValido(req: Request): boolean {
  const t = Buffer.from(req.headers.get("x-voz-token") ?? ""), esperado = Buffer.from(process.env.VOZ_TOKEN ?? "");
  return esperado.length >= 16 && t.length === esperado.length && timingSafeEqual(t, esperado);
}
