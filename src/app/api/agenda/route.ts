import { NextResponse } from "next/server";
import { agenda } from "@/lib/motor/servicio";
import { leerSesion, sinSesion } from "@/lib/sesion";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!leerSesion(req)) return sinSesion(); // estados de revisión: solo con la sesión de la mesa
  return NextResponse.json(await agenda());
}
