import { NextResponse } from "next/server";
import { z } from "zod";
import { ajustarPaquete, ErrorAjuste } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
const entrada = z.object({ instruccion: z.string().min(1).max(500).refine((s) => !!s.trim()) }).strict();
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const body = entrada.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "La instrucción debe tener entre 1 y 500 caracteres, sin campos adicionales." }, { status: 400 });
  try {
    return NextResponse.json(await ajustarPaquete((await ctx.params).id, body.data.instruccion, s.nombre));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ajustar el paquete." }, { status: error instanceof ErrorAjuste ? error.status : 500 });
  }
}
