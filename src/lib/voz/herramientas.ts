// Las 3 herramientas de Jarvis-TVN. Corren en Next con el motor de siempre: la voz nunca consulta datos por su cuenta.
import { consulta, estadoDe, snapshot } from "../motor/servicio";
import { consultar } from "../motor/consulta";
import { tokenizar } from "../motor/bm25";
import { explicacionFija, type VistaVoz } from "./catalogo";
import { contextoDe, encolar } from "./registro";

const DESTINOS: VistaVoz[] = ["portada", "agenda", "tablero", "control", "ficha"];
const NOMBRE: Record<VistaVoz, string> = { portada: "la portada", agenda: "la agenda", tablero: "el tablero", control: "Control", ficha: "la ficha" };
const palabras = (t: string, max: number) => { const w = t.split(/\s+/); return w.length > max ? w.slice(0, max).join(" ") + "…" : t; };

/** Eventos cuyo titular comparte al menos la mitad de las palabras de la consulta, mejor primero. */
export function buscarEventos(texto: string, max = 3) {
  const q = [...new Set(tokenizar(texto))];
  if (!q.length) return [];
  const snap = snapshot();
  const titulo = new Map(snap.noticias.map((n) => [n.id_noticia, n.titulo]));
  return snap.eventos
    .filter((e) => !e.no_confiable)
    .map((e) => { const t = titulo.get(e.representante) ?? ""; const tk = new Set(tokenizar(t)); return { id: e.id, titulo: t, score: q.filter((x) => tk.has(x)).length / q.length, P: e.P }; })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.P - a.P)
    .slice(0, max)
    .map(({ id, titulo, score }) => ({ id, titulo, score }));
}

const MOVER = { arriba: "Subí la página.", abajo: "Bajé la página.", inicio: "Volví al inicio de la página.", final: "Bajé hasta el final." } as const;

export function navegar(hilo: string, args: { destino?: string; consulta?: string; eventoId?: string }): string {
  const pedido = String(args.destino ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (Object.hasOwn(MOVER, pedido)) { encolar(hilo, { tipo: "desplazar", direccion: pedido as keyof typeof MOVER }); return MOVER[pedido as keyof typeof MOVER]; }
  if (pedido === "atras") { encolar(hilo, { tipo: "atras" }); return "Listo, volví a la pantalla anterior."; }
  const destino = pedido as VistaVoz;
  if (!DESTINOS.includes(destino)) return `No puedo abrir «${String(args.destino)}». Puedo abrir la portada, la agenda, el tablero, Control o la ficha de un tema, subir o bajar la página y volver atrás.`;
  if (destino !== "ficha") { encolar(hilo, { tipo: "navegar", vista: destino }); return `Listo, abrí ${NOMBRE[destino]}.`; }
  const snap = snapshot();
  if (args.eventoId && snap.eventos.some((e) => e.id === args.eventoId)) { encolar(hilo, { tipo: "navegar", vista: "ficha", eventoId: args.eventoId }); return "Listo, abrí la ficha."; }
  const r = buscarEventos(args.consulta ?? "");
  if (!r.length) return "No encontré un tema con ese nombre en la agenda de hoy. Dime otras palabras del titular.";
  if (r.length > 1 && r[0].score === r[1].score) return `Encontré varios temas parecidos: ${r.map((x, i) => `${i + 1}, ${palabras(x.titulo, 12)}`).join("; ")}. ¿Cuál abro?`;
  encolar(hilo, { tipo: "navegar", vista: "ficha", eventoId: r[0].id });
  return `Abrí la ficha de «${palabras(r[0].titulo, 14)}».`;
}

export async function preguntarCorpus(hilo: string, args: { pregunta?: string; eventoId?: string }): Promise<string> {
  const pregunta = String(args.pregunta ?? "").slice(0, 500).trim();
  if (!pregunta) return "No escuché la pregunta. ¿Me la repites?";
  if (args.eventoId && !snapshot().eventos.some((e) => e.id === args.eventoId)) return "Ese tema no está en el corte de hoy, así que no puedo responder sobre él.";
  // VOZ_RESPUESTA=extractiva (plan B si la latencia pasa de 15 s): la voz usa el motor sin la redacción de Claude
  const r = process.env.VOZ_RESPUESTA === "extractiva"
    ? await consultar(pregunta, snapshot(), { soloIds: args.eventoId ? snapshot().eventos.find((e) => e.id === args.eventoId)?.ids_noticia : undefined })
    : await consulta(pregunta, undefined, args.eventoId || undefined);
  encolar(hilo, { tipo: "mostrar", pregunta, respuesta: r });
  // Corto para la voz: el detalle con todas las citas queda en el panel (acción «mostrar»).
  if (r.abstener) return `No tengo evidencia para responder eso. ${r.motivo ?? ""}`.trim();
  const frases = (r.redaccion?.frases ?? r.afirmaciones).map((a) => a.texto);
  return `${palabras(frases.slice(0, 2).join(" "), 45)} El detalle con las citas quedó en el panel.`;
}

export async function explicarPantalla(hilo: string): Promise<string> {
  const c = contextoDe(hilo) ?? { vista: "portada" as const };
  const fijo = explicacionFija(c);
  if (c.vista === "ficha" && c.eventoId) {
    const snap = snapshot();
    const e = snap.eventos.find((x) => x.id === c.eventoId);
    if (!e) return fijo;
    const t = snap.noticias.find((n) => n.id_noticia === e.representante)?.titulo ?? "";
    const rev = (await estadoDe(e.id)).estado.replace("_", " ");
    return `${fijo} El tema abierto es «${palabras(t, 16)}»: P ${e.P}, prioridad ${e.rango}, evidencia ${e.estado_evidencia}, ${e.ids_noticia.length} publicaciones, estado de revisión ${rev}.${e.contradicciones.length ? ` Tiene ${e.contradicciones.length} contradicción abierta entre fuentes.` : ""}`;
  }
  if (c.vista === "agenda" && c.filtrosAgenda) return `${fijo} Ahora tienes filtrado: ${c.filtrosAgenda}.`;
  if (c.vista === "tablero" && c.filtroTablero) return `${fijo} Ahora el tablero está filtrado por ${c.filtroTablero}.`;
  return fijo;
}
