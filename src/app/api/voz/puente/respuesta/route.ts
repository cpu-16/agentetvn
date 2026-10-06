import { NextResponse } from "next/server";
import { recibirRespuesta } from "@/lib/voz/enlace";
import { tokenValido } from "@/lib/voz/puente";
export const dynamic = "force-dynamic";
/** El puente contesta una oferta: {id, ok:true, sdp, hilo} o {id, ok:false, status, error}. */
export async function POST(req: Request) {
  if (!tokenValido(req)) return NextResponse.json({ error: "token" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; ok?: boolean; sdp?: string; hilo?: string; status?: number; error?: string };
  if (!b.id) return NextResponse.json({ error: "id" }, { status: 400 });
  const aceptada = recibirRespuesta(b.id, b.ok && b.sdp && b.hilo ? { ok: true, sdp: b.sdp, hilo: b.hilo } : { ok: false, status: Number(b.status) || 502, error: String(b.error ?? "falló") });
  return NextResponse.json({ ok: true, aceptada }); // aceptada=false: nadie la esperaba → el puente cuelga esa llamada
}
