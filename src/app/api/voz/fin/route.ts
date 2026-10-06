import { NextResponse } from "next/server";
import { tokenValido } from "@/lib/voz/puente";
import { cerrarLlamada, encolar, existeLlamada } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
/** El puente cortó la llamada (tope, cupo, caída): la página lo ve en su próxima consulta de acciones y luego se borra. */
export async function POST(req: Request) {
  if (!tokenValido(req)) return NextResponse.json({ error: "token" }, { status: 401 });
  const { hilo, motivo } = (await req.json().catch(() => ({}))) as { hilo?: string; motivo?: string };
  if (hilo && existeLlamada(hilo)) {
    encolar(hilo, { tipo: "colgada", motivo: String(motivo ?? "terminó").slice(0, 80) });
    setTimeout(() => cerrarLlamada(hilo), 15_000); // ponytail: margen para que la página lea la acción
  }
  return NextResponse.json({ ok: true });
}
