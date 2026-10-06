import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { pedirColgar } from "@/lib/voz/enlace";
import { cerrarLlamada, esDueno } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const u = new URL(req.url), hilo = u.searchParams.get("hilo") ?? "";
  if (!esDueno(hilo, s.nombre, s.desde)) return NextResponse.json({ error: "no es tu llamada" }, { status: 403 });
  pedirColgar(hilo, (u.searchParams.get("motivo") ?? "colgó").slice(0, 60));
  cerrarLlamada(hilo);
  return NextResponse.json({ ok: true });
}
