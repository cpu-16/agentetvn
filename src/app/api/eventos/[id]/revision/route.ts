import { NextResponse } from "next/server";
import { revisar } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const body = await req.json().catch(() => ({}));
  const r = await revisar(id, body.estado, s.nombre, body.motivo, body.evidenciaPendiente);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
