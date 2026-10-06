import { NextResponse } from "next/server";
import { esperarComando } from "@/lib/voz/enlace";
import { tokenValido } from "@/lib/voz/puente";
export const dynamic = "force-dynamic";
/** Long-poll del puente (≤ 25 s): devuelve el siguiente comando o {tipo:"nada"}. Anuncia que el puente está vivo. */
export async function GET(req: Request) {
  if (!tokenValido(req)) return NextResponse.json({ error: "token" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const ms = Math.min(25_000, Math.max(100, Number(q.get("ms") ?? 25_000)));
  const c = await esperarComando({ ocupada: q.get("ocupada") === "1", seg_hora: Number(q.get("seg_hora") ?? 0) || 0, activa: (q.get("activa") ?? "").slice(0, 120) || undefined }, ms);
  return NextResponse.json(c ?? { tipo: "nada" });
}
