import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { esDueno, existeLlamada, sacarAcciones } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const hilo = new URL(req.url).searchParams.get("hilo") ?? "";
  if (!existeLlamada(hilo)) return NextResponse.json({ error: "la llamada terminó" }, { status: 404 });
  if (!esDueno(hilo, s.nombre, s.desde)) return NextResponse.json({ error: "no es tu llamada" }, { status: 403 });
  return NextResponse.json({ acciones: sacarAcciones(hilo) });
}
