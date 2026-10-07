import { NextResponse } from "next/server";
import { revisarBoletinBancario } from "@/lib/motor/banca-servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { z } from "zod";
import { ESTADOS_REVISION } from "@/lib/motor/contrato";
const esquema = z.object({ estado: z.enum(ESTADOS_REVISION), motivo: z.string().max(2000).nullable().optional(),
  version: z.iso.datetime().optional(), revisionId: z.string().nullable().optional(), fuentesRevisadas: z.boolean().optional() }).strict();
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = leerSesion(req);
  if (!session) return sinSesion();
  const parsed = esquema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud de revisión inválida." }, { status: 400 });
  const body = parsed.data;
  const r = await revisarBoletinBancario((await ctx.params).id, body.estado, session.nombre, body.motivo, body.version, body.revisionId ?? null, body.fuentesRevisadas === true);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
