import { NextResponse } from "next/server";
import { consulta } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
import type { ContextoPantalla } from "@/lib/voz/catalogo";
const VISTAS = ["portada", "agenda", "tablero", "ficha", "control"];
/** Solo la vista y la pestaña (lo que usa el texto fijo de la pantalla); lo demás se descarta. */
const contextoValido = (c: unknown): ContextoPantalla | null => {
  const x = c as { vista?: unknown; pestana?: unknown } | null;
  return x && typeof x.vista === "string" && VISTAS.includes(x.vista) ? { vista: x.vista as ContextoPantalla["vista"], pestana: x.pestana === "paquete" ? "paquete" : "evidencia" } : null;
};
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!leerSesion(req)) return sinSesion(); // el chat también exige la sesión de la mesa (y en modo online consume el LLM)
  const body = await req.json().catch(() => ({}));
  if (!body.q?.trim()) return NextResponse.json({ error: "q obligatoria" }, { status: 400 });
  return NextResponse.json(await consulta(String(body.q).slice(0, 500), body.modo, body.eventoId, "texto", contextoValido(body.contexto)));
}
