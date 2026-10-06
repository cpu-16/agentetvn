import { NextResponse } from "next/server";
import { consulta } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!leerSesion(req)) return sinSesion(); // el chat también exige la sesión de la mesa (y en modo online consume el LLM)
  const body = await req.json().catch(() => ({}));
  if (!body.q?.trim()) return NextResponse.json({ error: "q obligatoria" }, { status: 400 });
  return NextResponse.json(await consulta(String(body.q).slice(0, 500), body.modo, body.eventoId));
}
