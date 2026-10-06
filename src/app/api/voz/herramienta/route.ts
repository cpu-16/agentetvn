import { NextResponse } from "next/server";
import { tokenValido } from "@/lib/voz/puente";
import { existeLlamada } from "@/lib/voz/registro";
import { explicarPantalla, navegar, preguntarCorpus } from "@/lib/voz/herramientas";
export const dynamic = "force-dynamic";
/** El puente pide una herramienta. Lista cerrada; solo para llamadas abiertas. */
export async function POST(req: Request) {
  if (!tokenValido(req)) return NextResponse.json({ error: "token" }, { status: 401 });
  const { hilo, nombre, args } = (await req.json().catch(() => ({}))) as { hilo?: string; nombre?: string; args?: Record<string, string> };
  if (!["preguntar_corpus", "explicar_pantalla", "navegar"].includes(String(nombre))) return NextResponse.json({ error: `herramienta no permitida: ${String(nombre)}` }, { status: 400 });
  if (!hilo || !existeLlamada(hilo)) return NextResponse.json({ texto: "La llamada ya terminó." }, { status: 404 });
  const a = args ?? {};
  const texto = nombre === "preguntar_corpus" ? await preguntarCorpus(hilo, a) : nombre === "explicar_pantalla" ? await explicarPantalla(hilo) : navegar(hilo, a);
  return NextResponse.json({ texto });
}
