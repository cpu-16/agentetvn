import { NextResponse } from "next/server";
import { conCookie, leerSesion, pinMesa, ROLES, type Rol } from "@/lib/sesion";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = leerSesion(req);
  return NextResponse.json(s ? { sesion: { nombre: s.nombre, rol: s.rol } } : { sesion: null });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const nombre = String(body.nombre ?? "").trim().slice(0, 60);
  const rol = String(body.rol ?? "") as Rol;
  const pin = String(body.pin ?? "");
  if (!nombre) return NextResponse.json({ error: "Escribe tu nombre: cada decisión lleva responsable." }, { status: 400 });
  if (!ROLES.includes(rol)) return NextResponse.json({ error: "Elige un rol de la mesa." }, { status: 400 });
  if (pin !== pinMesa()) return NextResponse.json({ error: "El PIN de la mesa no coincide." }, { status: 401 });
  const sesion = { nombre, rol, desde: new Date().toISOString() };
  return conCookie(NextResponse.json({ sesion: { nombre, rol } }), sesion);
}

export async function DELETE() {
  return conCookie(NextResponse.json({ sesion: null }), null);
}
