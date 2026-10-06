import { NextResponse } from "next/server";
import { evento } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!leerSesion(req)) return sinSesion(); // historial y paquetes editados: solo con la sesión de la mesa
  const { id } = await ctx.params;
  const e = await evento(id);
  return e ? NextResponse.json(e) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
