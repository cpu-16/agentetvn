// Sesión de la mesa: cookie httpOnly `mesa` firmada con HMAC (secreto = PIN). Sin base de datos: la persona y el rol viajan en la cookie.
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export type Rol = "editor" | "periodista" | "productor" | "analista";
export interface Sesion { nombre: string; rol: Rol; desde: string }
export const ROLES: Rol[] = ["editor", "periodista", "productor", "analista"];
const COOKIE = "mesa";
const DOCE_HORAS = 12 * 3600;
const PIN_RESPALDO = "tvn2026";
let avisado = false;
export const pinMesa = () => {
  const pin = process.env.AGENTETVN_PIN;
  if (!pin && !avisado) {
    avisado = true;
    console.warn("[agentetvn] AGENTETVN_PIN no está definido: se usa el PIN de respaldo de la demo. Define uno en .env para una mesa real.");
  }
  return pin || PIN_RESPALDO;
};

/** Comparación en tiempo constante (buffers del mismo largo: se rellena para no filtrar la longitud). */
export function pinCoincide(candidato: string): boolean {
  const a = Buffer.from(candidato.padEnd(64, "\0").slice(0, 64));
  const b = Buffer.from(pinMesa().padEnd(64, "\0").slice(0, 64));
  return candidato.length === pinMesa().length && timingSafeEqual(a, b);
}

const firmar = (payload: string) => createHmac("sha256", `agentetvn:${pinMesa()}`).update(payload).digest("base64url");

export function serializar(s: Sesion): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

export function leerSesion(req: Request): Sesion | null {
  const crudo = req.headers.get("cookie") ?? "";
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(crudo);
  if (!m) return null;
  const [payload, firma] = decodeURIComponent(m[1]).split(".");
  if (!payload || !firma) return null;
  const esperada = firmar(payload);
  if (esperada.length !== firma.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Sesion;
    if (!s.nombre || !ROLES.includes(s.rol)) return null;
    if (Date.now() - new Date(s.desde).getTime() > DOCE_HORAS * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

/** `secure` solo cuando la petición llega por HTTPS (directo o detrás del proxy de Cloudflare).
 *  No depende de NODE_ENV: la demo del jurado corre `next start` por http://localhost y el navegador descartaría una cookie `secure`. */
export function esHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https" || req.url.startsWith("https://");
}

export function conCookie(res: NextResponse, s: Sesion | null, req: Request): NextResponse {
  if (s) res.cookies.set(COOKIE, serializar(s), { httpOnly: true, sameSite: "lax", path: "/", maxAge: DOCE_HORAS, secure: esHttps(req) });
  else res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export const sinSesion = () => NextResponse.json({ error: "Entra a la mesa con tu nombre, rol y PIN para registrar decisiones." }, { status: 401 });
