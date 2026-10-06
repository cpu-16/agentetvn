import { NextResponse } from "next/server";
import { snapshot } from "@/lib/motor/servicio";
import { agregarTablero } from "@/lib/motor/tablero";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";

let cache: { huella: string; cuerpo: ReturnType<typeof agregarTablero> } | null = null;

export async function GET(req: Request) {
  if (!leerSesion(req)) return sinSesion(); // la mesa está detrás del PIN: también sus lecturas
  const snap = snapshot();
  if (!cache || cache.huella !== snap.huella) cache = { huella: snap.huella, cuerpo: agregarTablero(snap) };
  return NextResponse.json(cache.cuerpo);
}
