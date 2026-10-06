import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { estadoPuente } from "@/lib/voz/enlace";
import { motivoInactiva, vozActiva } from "@/lib/voz/puente";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!leerSesion(req)) return sinSesion();
  if (!vozActiva()) return NextResponse.json({ disponible: false, motivo: motivoInactiva() });
  const p = estadoPuente();
  if (!p.vivo) return NextResponse.json({ disponible: false, motivo: "La voz no está disponible ahora." });
  return NextResponse.json({ disponible: !p.ocupada, ocupada: p.ocupada, ...(p.ocupada ? { motivo: "La voz está ocupada con otra persona." } : {}) });
}
