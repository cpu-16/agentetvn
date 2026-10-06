import { NextResponse } from "next/server";
import { snapshot } from "@/lib/motor/servicio";
import { agregarTablero } from "@/lib/motor/tablero";
export const dynamic = "force-dynamic";

let cache: { huella: string; cuerpo: ReturnType<typeof agregarTablero> } | null = null;

export async function GET() {
  const snap = snapshot();
  if (!cache || cache.huella !== snap.huella) cache = { huella: snap.huella, cuerpo: agregarTablero(snap) };
  return NextResponse.json(cache.cuerpo);
}
