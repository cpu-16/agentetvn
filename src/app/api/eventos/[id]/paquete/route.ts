import { NextResponse } from "next/server";
import { guardarPaquete, paquete } from "@/lib/motor/servicio";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const p = await paquete(id, body.persona ?? "sin nombre", body.regenerar === true);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.paquete || !body?.persona) return NextResponse.json({ error: "paquete y persona obligatorios" }, { status: 400 });
  return NextResponse.json(await guardarPaquete(id, body.paquete, body.persona));
}
