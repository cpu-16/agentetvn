import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { estadoPuente, ofertaPendiente, pedirOferta, puenteVivo } from "@/lib/voz/enlace";
import { motivoInactiva, vozActiva } from "@/lib/voz/puente";
export const dynamic = "force-dynamic";
const NO_DISPONIBLE = "La voz no está disponible ahora. Puedes escribir tu pregunta.";
const OCUPADA = "La voz está ocupada con otra persona o llegó al tope de esta hora. Escribe tu pregunta mientras tanto.";
export async function POST(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  if (!vozActiva()) return NextResponse.json({ error: motivoInactiva() }, { status: 503 });
  const sdp = (await req.text()).slice(0, 20_000);
  if (!sdp.startsWith("v=0")) return NextResponse.json({ error: "oferta inválida" }, { status: 400 });
  if (!puenteVivo()) return NextResponse.json({ error: NO_DISPONIBLE }, { status: 503 });
  if (estadoPuente().ocupada || ofertaPendiente()) return NextResponse.json({ error: OCUPADA }, { status: 429 }); // sin encolar: el puente no acumula trabajo
  const r = await pedirOferta(sdp, s.nombre, s.desde);
  if (!r.ok) return NextResponse.json({ error: r.status === 429 ? OCUPADA : NO_DISPONIBLE }, { status: r.status === 429 ? 429 : 503 });
  return new Response(r.sdp, { headers: { "content-type": "application/sdp", "x-hilo": r.hilo } });
}
