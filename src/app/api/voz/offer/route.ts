import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { pedirOferta, puenteVivo } from "@/lib/voz/enlace";
import { motivoInactiva, vozActiva } from "@/lib/voz/puente";
import { abrirLlamada } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
const NO_DISPONIBLE = "La voz no está disponible ahora. Puedes escribir tu pregunta.";
export async function POST(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  if (!vozActiva()) return NextResponse.json({ error: motivoInactiva() }, { status: 503 });
  const sdp = (await req.text()).slice(0, 20_000);
  if (!sdp.startsWith("v=0")) return NextResponse.json({ error: "oferta inválida" }, { status: 400 });
  if (!puenteVivo()) return NextResponse.json({ error: NO_DISPONIBLE }, { status: 503 });
  const r = await pedirOferta(sdp, s.nombre);
  if (!r.ok) return NextResponse.json({ error: r.status === 429 ? "La voz está ocupada con otra persona o llegó al tope de esta hora. Escribe tu pregunta mientras tanto." : NO_DISPONIBLE }, { status: r.status === 429 ? 429 : 503 });
  abrirLlamada(r.hilo, s.nombre, s.desde);
  return new Response(r.sdp, { headers: { "content-type": "application/sdp", "x-hilo": r.hilo } });
}
