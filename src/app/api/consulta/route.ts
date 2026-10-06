import { NextResponse } from "next/server";
import { consulta } from "@/lib/motor/servicio";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.q?.trim()) return NextResponse.json({ error: "q obligatoria" }, { status: 400 });
  return NextResponse.json(await consulta(String(body.q).slice(0, 500), body.modo, body.eventoId));
}
