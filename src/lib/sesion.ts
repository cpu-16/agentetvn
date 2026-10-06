// Sesión de la mesa: cookie httpOnly `mesa` firmada con HMAC (secreto = PIN). Sin base de datos: la persona y el rol viajan en la cookie.
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export type Rol = "editor" | "periodista" | "productor";
export interface Sesion { nombre: string; rol: Rol; desde: string }
export const ROLES: Rol[] = ["editor", "periodista", "productor"];
const COOKIE = "mesa";
const DOCE_HORAS = 12 * 3600;
export const pinMesa = () => process.env.AGENTETVN_PIN ?? "tvn2026";

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

export function conCookie(res: NextResponse, s: Sesion | null): NextResponse {
  if (s) res.cookies.set(COOKIE, serializar(s), { httpOnly: true, sameSite: "lax", path: "/", maxAge: DOCE_HORAS, secure: process.env.NODE_ENV === "production" });
  else res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export const sinSesion = () => NextResponse.json({ error: "Entra a la mesa con tu nombre, rol y PIN para registrar decisiones." }, { status: 401 });
