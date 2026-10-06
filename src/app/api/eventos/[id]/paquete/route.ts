import { NextResponse } from "next/server";
import { guardarPaquete, paquete } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const body = await req.json().catch(() => ({}));
  const p = await paquete(id, s.nombre, body.regenerar === true);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const body = await req.json().catch(() => null);
  if (!body?.paquete) return NextResponse.json({ error: "paquete obligatorio" }, { status: 400 });
  return NextResponse.json(await guardarPaquete(id, body.paquete, s.nombre));
}
