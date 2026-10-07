import { NextResponse } from "next/server";
import { boletinBancario, detalleBancario, guardarBoletinBancario } from "@/lib/motor/banca-servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { z } from "zod";
const generar = z.object({ regenerar: z.boolean().optional() }).strict();
const guardar = z.object({ boletin: z.unknown().refine((v) => !!v && typeof v === "object"),
  version: z.iso.datetime() }).strict();
const invalido = () => NextResponse.json({ error: "Solicitud bancaria inválida." }, { status: 400 });
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  if (!leerSesion(req)) return sinSesion();
  const d = await detalleBancario((await ctx.params).id);
  return d ? NextResponse.json(d) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
export async function POST(req: Request, ctx: Context) {
  const session = leerSesion(req);
  if (!session) return sinSesion();
  const { id } = await ctx.params, parsed = generar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalido();
  const b = await boletinBancario(id, session.nombre, parsed.data.regenerar === true);
  return b ? NextResponse.json(await detalleBancario(id)) : NextResponse.json({ error: "evento no existe" }, { status: 404 });
}
export async function PUT(req: Request, ctx: Context) {
  const session = leerSesion(req);
  if (!session) return sinSesion();
  const { id } = await ctx.params, parsed = guardar.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalido();
  const r = await guardarBoletinBancario(id, parsed.data.boletin, session.nombre, parsed.data.version);
  return r.ok ? NextResponse.json(r.detalle) : NextResponse.json({ error: r.error }, { status: r.status });
}
