import { NextResponse } from "next/server";
import { revisar } from "@/lib/motor/servicio";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const r = await revisar(id, body.estado, body.persona, body.motivo, body.evidenciaPendiente);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
