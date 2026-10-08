// Las 3 herramientas de Jarvis-TVN. Corren en Next con el motor de siempre: la voz nunca consulta datos por su cuenta.
import { consulta, estadoDe, respuestaGuia, snapshot } from "../motor/servicio";
import { tokenizar } from "../motor/bm25";
import { CAPACIDADES, explicacionFija, PLATAFORMA_CORTA, queHaceRol, type VistaVoz } from "./catalogo";
import { buscarParte, RECORRIDO_GUIA } from "./guia";
import { personaDe, contextoDe, encolar, guardarContexto, momentoPaso, pasoRecorrido, pasoRetomable, sinPreguntar } from "./registro";

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

const dosFrases = (t: string) => t.split(/(?<=\.)\s+/).slice(0, 2).join(" ");
const MOVER = { arriba: "Subí la página.", abajo: "Bajé la página.", inicio: "Volví al inicio de la página.", final: "Bajé hasta el final." } as const;

/** Encola la parte para que la página la muestre (navegar, bajar, resaltar, demostrar) y devuelve su explicación. */
function mostrarParte(hilo: string, id: string, recorrido = false): string {
  const r = respuestaGuia({ tipo: "guia", parte: id, recorrido }, "embeddings");
  if (r.guia) { encolar(hilo, { tipo: "guia", ...r.guia }); guardarContexto(hilo, { vista: r.guia.vista as VistaVoz, eventoId: r.guia.eventoId ?? null }); }
  return r.conversacion!.texto.replace(" Ese fue el recorrido.", "");
}

// Un «siguiente» que llega antes de esto desde el paso anterior no viene de la persona (nadie contesta tan rápido): es el cerebro
// de la voz llamando en bucle dentro de un mismo turno. Se repite el paso que todavía no se leyó (prueba de Gilberto, 8-oct).
const MISMO_TURNO_MS = 2500;
const textoGuia = (id: string) => respuestaGuia({ tipo: "guia", parte: id, recorrido: true }, "embeddings").conversacion!.texto.replace(" Ese fue el recorrido.", "");
// El paso va solo con su texto (el número y el título los muestra el cartel): leído en voz alta «Paso 6 de 13 · La ficha:»
// sonaba a máquina. Los cierres rotan para que no sea siempre «¿Seguimos?» (prueba de Gilberto, 8-oct).
const CIERRES = ["¿Seguimos?", "¿Vamos con lo que sigue?", "¿Te muestro lo siguiente?", "¿Dale, seguimos?", "¿Pasamos a lo próximo?"];

export function navegar(hilo: string, args: { destino?: string; consulta?: string; eventoId?: string }, ahora = Date.now()): string {
  const pedido = String(args.destino ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (Object.hasOwn(MOVER, pedido)) { encolar(hilo, { tipo: "desplazar", direccion: pedido as keyof typeof MOVER }); return MOVER[pedido as keyof typeof MOVER]; }
  if (pedido === "atras") { encolar(hilo, { tipo: "atras" }); return "Listo, volví a la pantalla anterior."; }
  // Recorrido guiado: «recorrido» empieza; «siguiente» pasa a la próxima parte: la página navega, baja hasta esa parte,
  // la resalta y hace la demostración (cambiar de pestaña, filtrar el tablero). El paso se guarda en la llamada.
  // «seguido»: la persona pidió seguir hasta el final sin que le pregunten; avanza un paso y desde ahí no se pregunta
  if (pedido === "recorrido" || pedido === "siguiente" || pedido === "seguido") {
    if (pedido !== "siguiente") sinPreguntar(hilo, pedido === "seguido");
    const enEsta = pasoRecorrido(hilo), previo = enEsta ?? pasoRetomable(); // la llamada anterior se cortó a mitad: se retoma
    if (pedido !== "recorrido" && previo === undefined) return "No estamos en un recorrido. ¿Quieres que te muestre la plataforma parte por parte?";
    const pregunta = (i: number) => (i + 1 >= RECORRIDO_GUIA.length ? " Ese fue el recorrido." : sinPreguntar(hilo) ? "" : ` ${CIERRES[i % CIERRES.length]}`);
    const entrada = (i: number, retoma: boolean) => (i === 0 ? `Empecemos: son ${RECORRIDO_GUIA.length} partes cortas. ` : retoma ? "Seguimos donde quedamos. " : "");
    if (pedido !== "recorrido" && enEsta !== undefined && ahora - (momentoPaso(hilo) ?? 0) < MISMO_TURNO_MS) return `${entrada(enEsta, false)}${textoGuia(RECORRIDO_GUIA[enEsta])}${pregunta(enEsta)}`;
    const i = pedido === "recorrido" ? 0 : previo! + 1;
    if (i >= RECORRIDO_GUIA.length) { pasoRecorrido(hilo, null); return "Ese fue el recorrido completo. Si quieres, te digo la noticia del día o abro la ficha de un tema."; }
    pasoRecorrido(hilo, i); momentoPaso(hilo, ahora);
    return `${entrada(i, enEsta === undefined)}${mostrarParte(hilo, RECORRIDO_GUIA[i], true)}${pregunta(i)}`;
  }
  const destino = pedido as VistaVoz;
  if (!DESTINOS.includes(destino)) return `No puedo abrir «${String(args.destino)}». Puedo abrir la portada, la agenda, el tablero, Control o la ficha de un tema, subir o bajar la página y volver atrás.`;
  if (destino !== "ficha") { encolar(hilo, { tipo: "navegar", vista: destino }); if (contextoDe(hilo)?.vista !== destino) guardarContexto(hilo, { vista: destino }); return `Listo, abrí ${NOMBRE[destino]}. ${dosFrases(explicacionFija({ vista: destino }))}`; }
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
  // VOZ_RESPUESTA=extractiva solo apaga la redacción con LLM; el enrutador (agenda, plataforma) sigue igual (revisión de Codex)
  const r = await consulta(pregunta, undefined, args.eventoId || undefined, "voz", contextoDe(hilo), personaDe(hilo));
  encolar(hilo, { tipo: "mostrar", pregunta, respuesta: r });
  // Corto para la voz: el detalle con todas las citas queda en el panel (acción «mostrar»).
  if (r.guia) { encolar(hilo, { tipo: "guia", ...r.guia }); const t = r.conversacion?.texto ?? ""; return r.conversacion?.motivo === "verificar" ? `${palabras(t, 40)} El detalle quedó en la ficha.` : t; }
  if (r.conversacion) return r.conversacion.motivo === "plataforma" ? PLATAFORMA_CORTA : r.conversacion.texto;
  if (r.agenda) return r.agenda.encabezado ? `${palabras(r.agenda.texto, 30)} La lista quedó en el panel.` : r.agenda.texto; // la mesa del rol, corta para la voz
  if (r.abstener) return `No tengo evidencia para responder eso. ${r.motivo ?? ""}`.trim();
  const frases = (r.redaccion?.frases ?? r.afirmaciones).map((a) => a.texto);
  return `${palabras(frases.slice(0, 2).join(" "), 45)} El detalle con las citas quedó en el panel.`;
}

/** Para la voz: las dos primeras frases del texto fijo (el panel muestra el texto completo con «Explícame esta pantalla»). */

export async function explicarPantalla(hilo: string, args: { sobre?: string } = {}): Promise<string> {
  const sobre = String(args.sobre ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (sobre.startsWith("plataforma")) return PLATAFORMA_CORTA;
  const rol = queHaceRol(sobre); // «yo entro como periodista, ¿qué hago?» (va antes: «¿qué puedo hacer como periodista?» es del rol)
  if (rol) return rol;
  // solo la pregunta entera: «¿qué se puede hacer con los filtros?» es de esa parte, no de las capacidades (revisión de Codex y Cursor)
  if (/^(capacidades|que (se puede|puedes|puedo) hacer( aqui| tu| conmigo)?|que haces( tu)?|para que sirves)$/.test(sobre.replace(/[^a-zñ ]/g, "").replace(/\s+/g, " ").trim())) return CAPACIDADES;
  const p = args.sobre ? buscarParte(args.sobre, contextoDe(hilo)?.vista) : null; // «explícame la gráfica de medios»: la muestra y la explica
  if (p) return mostrarParte(hilo, p.id);
  // «explícame la parte de Control»: una sección entera sin parte propia → la abre y la explica
  const seccion = DESTINOS.find((d) => d !== "ficha" && new RegExp(`\\b${d}\\b`).test(sobre));
  if (seccion) return navegar(hilo, { destino: seccion });
  const c = contextoDe(hilo) ?? { vista: "portada" as const };
  const fijo = dosFrases(explicacionFija(c));
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
