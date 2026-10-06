import { appendFileSync } from "fs";
import { NextResponse } from "next/server";
import { leerSesion, sinSesion } from "@/lib/sesion";
import { contarTurno, contextoDe, esDueno } from "@/lib/voz/registro";
export const dynamic = "force-dynamic";
/** Registro de los turnos de voz (lo que dijo la persona y lo que dijo Jarvis), sin el nombre de la persona: para revisar
 *  en qué se equivocó la voz. Solo el dueño de la llamada. ponytail: JSONL que crece, como db/consultas.jsonl. */
export async function POST(req: Request) {
  const s = leerSesion(req);
  if (!s) return sinSesion();
  const hilo = new URL(req.url).searchParams.get("hilo") ?? "";
  if (!esDueno(hilo, s.nombre, s.desde)) return NextResponse.json({ error: "no es tu llamada" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 4000) return NextResponse.json({ error: "turno demasiado largo" }, { status: 413 });
  if (!contarTurno(hilo)) return NextResponse.json({ error: "demasiados turnos" }, { status: 429 }); // una llamada de 3 min no da para más
  const crudo = await req.text();
  if (Buffer.byteLength(crudo) > 4000) return NextResponse.json({ error: "turno demasiado largo" }, { status: 413 });
  let b: { quien?: unknown; texto?: unknown } | null = null;
  try { b = JSON.parse(crudo); } catch { /* inválido abajo */ }
  if (!b || typeof b !== "object" || (b.quien !== "persona" && b.quien !== "jarvis") || typeof b.texto !== "string") return NextResponse.json({ error: "turno inválido" }, { status: 400 });
  try {
    appendFileSync(process.env.AGENTETVN_REGISTRO_VOZ ?? (process.env.NODE_ENV === "test" ? "/dev/null" : "db/voz-turnos.jsonl"), JSON.stringify({ fecha: new Date().toISOString(), hilo: hilo.slice(-6), quien: b.quien, texto: b.texto.slice(0, 1000), vista: contextoDe(hilo)?.vista ?? null }) + "\n");
  } catch { /* el registro nunca tumba la llamada */ }
  return NextResponse.json({ ok: true });
}
