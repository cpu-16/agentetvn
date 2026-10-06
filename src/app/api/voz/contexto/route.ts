import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import type { ContextoPantalla, VistaVoz } from "@/lib/voz/catalogo";
import { esDueno, guardarContexto } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
const VISTAS: VistaVoz[] = ["portada", "agenda", "tablero", "ficha", "control"];
const corto = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
export async function POST(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const hilo = new URL(req.url).searchParams.get("hilo") ?? "";
  if (!esDueno(hilo, s.nombre, s.desde)) return NextResponse.json({ error: "no es tu llamada" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!VISTAS.includes(b.vista as VistaVoz)) return NextResponse.json({ error: "vista inválida" }, { status: 400 });
  const c: ContextoPantalla = { vista: b.vista as VistaVoz, eventoId: corto(b.eventoId) ?? null, pestana: b.pestana === "paquete" ? "paquete" : b.pestana === "evidencia" ? "evidencia" : undefined, filtrosAgenda: corto(b.filtrosAgenda), filtroTablero: corto(b.filtroTablero) };
  guardarContexto(hilo, c);
  return NextResponse.json({ ok: true });
}
