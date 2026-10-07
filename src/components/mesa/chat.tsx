"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { BotonCita, Citas, type Indicador, type Publicacion, type Sismo } from "./citas";
import { SPRING_PANEL, fetchMesa, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";
import { ETIQUETA_ORBE, Orbe } from "./jarvis/orbe";
import { estadoOrbe, vozActiva } from "./jarvis/maquina";
import { useVoz } from "./jarvis/useVoz";
import { clasesPanel, esCelular, type TamanoPanel } from "./jarvis/panel";
import { contextoDesdeMesa, explicacionFija } from "@/lib/voz/catalogo";
import { TrazaBuscando, TrazaBusqueda, type Traza } from "./traza";
import { mostrarGuia } from "./jarvis/guia";
import type { Guia } from "@/lib/motor/consulta";

interface Afirmacion { texto: string; tipo: string; evidence_id: string; campo: string; alcance: string }
interface Respuesta { abstener: boolean; motivo?: string; faltante?: string; afirmaciones: Afirmacion[]; evidencias: { id: string; tipo: string; resumen: string; score: number }[]; contradicciones: { detalle: string }[]; modo: string; ms: number; leyenda: string; redaccion?: { frases: Afirmacion[]; vacios: string[]; llm: { modelo: string; ms: number } }; traza?: Traza; guia?: Guia; conversacion?: { motivo: string; texto: string; sugerencias: string[] }; agenda?: { uno: boolean; texto: string; items: { eventoId: string; idNoticia: string; titulo: string; medio: string; P: number; rango: string; evidencia: string; razon: string; falta: string | null; publicaciones: number }[] } }
const nombreModelo = (m: string) => (m === "claude-opus-5-5" ? "Claude Opus 5.5" : m);
interface Turno { id: number; pregunta: string; ambito: string | null; respuesta: Respuesta | null; error: string | null; voz?: { quien: "persona" | "jarvis" | "sistema"; texto: string } }

const SUGERIDAS: { q: string; etiqueta?: string }[] = [
  { q: "¿Qué cinco temas merecen revisión hoy?" },
  { q: "¿Qué se sabe de la aprehensión de Enrique Lau?" },
  { q: "¿Cuál fue la inflación de Panamá en 2025?" },
];

export function ChatAgente() {
  const chatAbierto = useMesa((s) => s.chatAbierto);
  const setChatAbierto = useMesa((s) => s.setChatAbierto);
  const modoConsulta = useMesa((s) => s.modoConsulta);
  const setModoConsulta = useMesa((s) => s.setModoConsulta);
  const vista = useMesa((s) => s.vista);
  const eventoId = useMesa((s) => s.eventoId);
  const irA = useMesa((s) => s.irA);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [q, setQ] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [soloTema, setSoloTema] = useState(true);
  const [cita, setCita] = useState<string | null>(null);
  const [evidencia, setEvidencia] = useState<{ pubs: Publicacion[]; inds: Indicador[]; sismos: Sismo[] }>({ pubs: [], inds: [], sismos: [] });
  const [anuncio, setAnuncio] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const reducir = useReducedMotion();
  const [tamano, setTamano] = useState<TamanoPanel>("compacto");
  const [celular, setCelular] = useState(false);
  const controles = useDragControls();
  const turnoVoz = (quien: "persona" | "jarvis" | "sistema", texto: string) => setTurnos((t) => [...t, { id: Date.now() + Math.random(), pregunta: "", ambito: null, respuesta: null, error: null, voz: { quien, texto } }]);
  const voz = useVoz({
    onTranscripcion: (quien, texto) => turnoVoz(quien, texto),
    onMostrar: (pregunta, respuesta) => setTurnos((t) => [...t, { id: Date.now() + Math.random(), pregunta: `🎙 ${pregunta}`, ambito: null, respuesta: respuesta as Respuesta, error: null }]),
    onAviso: (texto) => { setAnuncio(texto); turnoVoz("sistema", texto); },
    onGuia: (g) => { setCartel({ ...g, desdeChat: false }); void mostrarGuia(g); },
  });
  // Cartel de la guía: título y explicación de la parte que se está mostrando, encima de la página
  const [cartel, setCartel] = useState<(Guia & { desdeChat: boolean }) | null>(null);
  /** Empieza de cero: borra la conversación, cuelga la voz si estaba y quita el cartel. */
  const nuevaConversacion = () => { if (vozActiva(voz.estado)) voz.colgar("nueva conversación"); setTurnos([]); setCartel(null); setAnuncio("Conversación nueva."); setQ(""); };
  const arrastrable = !celular && tamano !== "amplio";
  // ponytail: la posición arrastrada vuelve al rincón al cambiar de tamaño o recargar; guardarla en sessionStorage si se pide
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const cambiar = () => setCelular(mq.matches);
    cambiar(); mq.addEventListener("change", cambiar);
    return () => mq.removeEventListener("change", cambiar);
  }, []);
  const orbe = estadoOrbe(voz.estado);
  const activa = vozActiva(voz.estado);
  /** Un toque al orbe: habla o cuelga. En escritorio abre el panel para ver la conversación; en el celular deja la pantalla libre. */
  const tocarOrbe = () => { voz.prepararAudio(); if (!activa && !celular) setChatAbierto(true); void voz.alternar(); };
  const enFicha = vista === "ficha" && !!eventoId;
  const ambito = enFicha && soloTema ? eventoId : null;

  // Foco: entra al cuadro al abrir y vuelve al botón al cerrar. En el celular no: el teclado tapaba la hoja (revisión de Cursor).
  useEffect(() => {
    if (!chatAbierto) return;
    const t = esCelular(window.innerWidth) ? undefined : setTimeout(() => entrada.current?.focus(), 60);
    const b = boton.current;
    return () => { clearTimeout(t); b?.focus({ preventScroll: true }); };
  }, [chatAbierto]);

  // Teclas y clic afuera. La voz se lee de una referencia (su identidad cambia en cada render).
  const vozRef = useRef(voz);
  useEffect(() => { vozRef.current = voz; });
  useEffect(() => {
    if (!chatAbierto) return;
    const enCampo = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest?.("textarea,input,select,button,summary,a,[role=button]");
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setChatAbierto(false); return; }
      if (e.code === "Space" && !e.repeat && !enCampo(e)) { e.preventDefault(); vozRef.current.prepararAudio(); void vozRef.current.alternar(); }
    };
    const fuera = (e: PointerEvent) => {
      if (tamano !== "compacto") return; // en lateral y amplio el panel acompaña la pantalla: un clic afuera no lo cierra
      const t = e.target as Node;
      if (panel.current && !panel.current.contains(t) && !(t as HTMLElement).closest?.(".jarvis-dock,[role=dialog]")) setChatAbierto(false);
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("pointerdown", fuera);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener("pointerdown", fuera); };
  }, [chatAbierto, setChatAbierto, tamano]);

  // Muestra el inicio del último turno (la pregunta y debajo cómo buscó), no el final de la respuesta.
  useEffect(() => { (fin.current?.previousElementSibling ?? fin.current)?.scrollIntoView({ block: "start", behavior: reducir ? "auto" : "smooth" }); }, [turnos, reducir]);

  const preguntar = async (texto: string, idExistente?: number, mostrar?: string) => {
    const pregunta = texto.trim();
    if (!pregunta || ocupado) return;
    const id = idExistente ?? Date.now();
    setTurnos((t) => (idExistente ? t.map((x) => (x.id === id ? { ...x, respuesta: null, error: null } : x)) : [...t, { id, pregunta: mostrar ?? pregunta, ambito, respuesta: null, error: null }]));
    setQ(""); setOcupado(true); setAnuncio("Buscando en las fuentes");
    try {
      const r = await fetchMesa("/api/consulta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: pregunta, modo: modoConsulta, eventoId: ambito ?? undefined, contexto: contextoDesdeMesa(useMesa.getState()) }) });
      if (!r.ok) throw new Error(r.status === 401 ? "La sesión venció." : `El agente no respondió (error ${r.status}).`);
      const respuesta = (await r.json()) as Respuesta;
      setTurnos((t) => t.map((x) => (x.id === id ? { ...x, respuesta } : x)));
      if (respuesta.guia) { setCartel({ ...respuesta.guia, desdeChat: true }); void mostrarGuia(respuesta.guia); }
      const red = respuesta.redaccion;
      setAnuncio(respuesta.conversacion ? respuesta.conversacion.texto : respuesta.abstener ? `Sin respuesta sustentada. ${respuesta.motivo ?? ""}` : red ? `Borrador de IA. ${red.frases.map((a) => a.texto).join(" ")}${red.vacios.length ? ` Qué falta en el borrador: ${red.vacios.join("; ")}` : ""}` : `Respuesta con ${respuesta.afirmaciones.length} afirmación(es) citada(s). ${respuesta.afirmaciones.map((a) => a.texto).join(" ")}`);
      const ids = respuesta.evidencias.filter((e) => e.tipo === "noticia").map((e) => e.id);
      if (ids.length || respuesta.evidencias.some((e) => e.tipo === "indicador")) void cargarEvidencia(ids, respuesta.evidencias.filter((e) => e.tipo === "indicador").map((e) => e.id));
    } catch (e) {
      const msg = e instanceof TypeError ? "No hubo conexión con el agente. Revisa la red e intenta otra vez." : (e as Error).message;
      setTurnos((t) => t.map((x) => (x.id === id ? { ...x, error: msg } : x)));
      setAnuncio(`Error: ${msg}`);
    } finally {
      setOcupado(false);
    }
  };

  // Evidencia para las citas: los eventos salen de la agenda ya cargada (caché del store); solo se piden las fichas necesarias.
  const cargarEvidencia = async (idsNoticia: string[], idsInd: string[]) => {
    try {
      const a = await useMesa.getState().cargarAgenda();
      const yaCargadas = new Set(evidencia.pubs.map((p) => p.id_noticia));
      const faltan = idsNoticia.filter((i) => !yaCargadas.has(i));
      const eventos = a ? a.eventos.filter((e) => e.ids_noticia.some((i) => faltan.includes(i))).slice(0, 5) : [];
      const detalles = await Promise.all(eventos.map((e) => fetchMesa(`/api/eventos/${e.id}`).then((r) => (r.ok ? r.json() : null))));
      const validos = detalles.filter(Boolean) as { publicaciones: Publicacion[]; indicadores: Indicador[]; sismos: Sismo[] }[];
      const pubs = validos.flatMap((d) => d.publicaciones);
      const inds = validos.flatMap((d) => d.indicadores);
      const extra: Indicador[] = idsInd.filter((id) => !inds.some((i) => `${i.pais_iso3}:${i.indicador_id}:${i.anio}` === id)).map((id) => { const [pais, ind, anio] = id.split(":"); return { pais_iso3: pais, indicador_id: ind, anio: Number(anio), valor: null, unidad: "", fuente_url: `https://api.worldbank.org/v2/country/${pais}/indicator/${ind}?date=${anio}&format=json`, fecha_extraccion: "", licencia: "CC BY 4.0 (Banco Mundial)" }; });
      setEvidencia((v) => ({ pubs: [...v.pubs, ...pubs], inds: [...v.inds, ...inds, ...extra], sismos: [...v.sismos, ...validos.flatMap((d) => d.sismos)] }));
    } catch { /* la cita mostrará «no corresponde» si no se pudo cargar */ }
  };

  const abrirFichaDe = (idNoticia: string) => {
    const ev = useMesa.getState().agenda?.eventos.find((e) => e.ids_noticia.includes(idNoticia));
    if (ev) { setChatAbierto(false); irA("ficha", ev.id); }
  };

  return (
    <>
      <div className="jarvis-dock">
        <button
          type="button"
          className="jarvis-boton presionable"
          data-activa={activa}
          aria-pressed={activa}
          aria-label={activa ? `Colgar a Jarvis. ${ETIQUETA_ORBE[orbe]}` : "Hablar con Jarvis"}
          onContextMenu={(e) => e.preventDefault()}
          onClick={tocarOrbe}
        >
          <Orbe estado={orbe} nivel={voz.nivel} />
          <span className="jarvis-texto">
            <span className="jarvis-accion">{activa ? "Colgar" : celular ? "Hablar" : "Hablar con Jarvis"}</span>
            {activa && !celular && <span className="jarvis-estado">{ETIQUETA_ORBE[orbe]}</span>}
          </span>
        </button>
        <button ref={boton} type="button" className="jarvis-escribir presionable" aria-expanded={chatAbierto} aria-controls="chat-agente" aria-haspopup="dialog" aria-label={chatAbierto ? "Cerrar el chat de Jarvis" : "Escribirle a Jarvis"} onClick={() => setChatAbierto(!chatAbierto)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span className="jarvis-texto">Escribir</span>
        </button>
      </div>
      <p className="solo-lector" aria-live="polite" aria-atomic="true">{anuncio}</p>
      <p className="solo-lector" aria-live="polite" aria-atomic="true">{activa ? `Voz: ${ETIQUETA_ORBE[orbe]}.` : ""}</p>{/* el lector oye cada cambio de estado de la voz (revisión de Cursor) */}
      <AnimatePresence>
        {chatAbierto && (
          <motion.div
            key={`capa-${tamano}-${celular}`}
            className="pointer-events-none fixed inset-0 z-50"
            drag={arrastrable ? (tamano === "lateral" ? "x" : true) : false}
            dragControls={controles}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: -(typeof window !== "undefined" ? window.innerWidth - 140 : 800), right: 0, top: -(typeof window !== "undefined" ? window.innerHeight - 140 : 500), bottom: 0 }}
          >
          <motion.div
            id="chat-agente"
            ref={panel}
            role="dialog"
            aria-modal={celular || tamano !== "lateral"}
            aria-labelledby="chat-titulo"
            className={cn("chat-panel pointer-events-auto flex flex-col", clasesPanel(tamano, celular), celular && "pb-[env(safe-area-inset-bottom)]", celular && tamano === "amplio" && "pt-[env(safe-area-inset-top)]")}
            style={{ transformOrigin: "calc(100% - 28px) calc(100% + 24px)" }}
            initial={reducir ? { opacity: 0 } : { opacity: 0, transform: "scale(0.94) translateY(8px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96) translateY(6px)", transition: { duration: 0.14 } }}
            transition={SPRING_PANEL}
          >
            <div
              className={cn("flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3", arrastrable && "cursor-grab select-none touch-none active:cursor-grabbing")}
              onPointerDown={(e) => { if (arrastrable && !(e.target as HTMLElement).closest("button,select,label")) controles.start(e); }}
            >
              <div>
                <p id="chat-titulo" className="titular text-base font-semibold leading-none">Jarvis</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Agente de la mesa</p>
              </div>
              <div className="flex items-center gap-2">
                {!celular && <label className="sr-only" htmlFor="chat-modo">Tipo de búsqueda</label>}
                {!celular && (<select id="chat-modo" value={modoConsulta} onChange={(e) => setModoConsulta(e.target.value as "embeddings" | "bm25")} className={cn("rounded-sm border border-border bg-white px-1.5 text-[11px]", celular ? "h-11" : "h-7")}>
                  <option value="embeddings">Por sentido</option>
                  <option value="bm25">Por palabras</option>
                </select>)}
                {celular ? (
                  <button type="button" className="presionable h-11 min-w-11 rounded-sm px-2 text-xs hover:bg-papel" aria-pressed={tamano === "amplio"} onClick={() => setTamano(tamano === "amplio" ? "compacto" : "amplio")}>{tamano === "amplio" ? "Reducir" : "Ampliar"}</button>
                ) : (
                  <div className="flex rounded-sm border border-border text-[11px]" role="group" aria-label="Tamaño del panel">
                    {(["compacto", "lateral", "amplio"] as const).map((t) => (
                      <button key={t} type="button" className={cn("presionable px-1.5 py-1 capitalize", tamano === t ? "bg-tinta text-white" : "hover:bg-papel")} aria-pressed={tamano === t} onClick={() => setTamano(t)}>{t}</button>
                    ))}
                  </div>
                )}
                <button type="button" className={cn("presionable rounded-sm px-1.5 py-1 text-xs text-acero hover:bg-papel", celular && "h-11 min-w-11")} onClick={nuevaConversacion} disabled={!turnos.length && !activa} title="Borrar la conversación y empezar de cero" aria-label="Nueva conversación">↺ Nueva</button>
                <button type="button" className={cn("presionable rounded-sm px-1.5 py-1 text-xs text-muted-foreground hover:bg-papel", celular && "h-11 min-w-11")} onClick={() => setChatAbierto(false)} aria-label="Cerrar el agente">✕</button>
              </div>
            </div>
            {enFicha && (
              <div className="flex items-center justify-between gap-2 bg-papel/70 px-4 py-1.5 text-[11px]">
                <span>{soloTema ? "Preguntando sobre este tema" : "Preguntando sobre todas las noticias del corte"}</span>
                <button className="presionable text-acero underline" onClick={() => setSoloTema((v) => !v)}>{soloTema ? "Ampliar a todas las noticias" : "Volver a este tema"}</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2 text-xs">
              <button type="button" className="presionable min-h-11 rounded-full border border-tinta/30 bg-white px-3 py-1 font-medium text-tinta hover:border-tinta sm:min-h-9" onClick={() => turnoVoz("jarvis", explicacionFija(contextoDesdeMesa(useMesa.getState())))}>Explícame esta pantalla</button>
              <span className={cn("text-muted-foreground", celular && turnos.length > 0 && !activa && "sr-only")}>{voz.estado === "no_disponible" ? "Voz no disponible ahora. El chat funciona igual." : activa ? `${ETIQUETA_ORBE[orbe]}. Habla cuando quieras; toca «Colgar» para terminar.` : celular ? "Toca «Hablar» para conversar con Jarvis." : "Toca «Hablar» (o la barra espaciadora) para conversar con Jarvis."}</span>
              {activa && <button type="button" className="presionable ml-auto min-h-11 rounded-sm px-3 text-acero underline sm:min-h-0 sm:py-1" onClick={() => voz.colgar("colgó")}>Colgar</button>}
            </div>
            <div className="fino flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 text-sm">
              {turnos.length === 0 && (
                <div>
                  <p className="text-muted-foreground">Escribe abajo o toca «Hablar». Te respondo con citas de las noticias y los datos oficiales del corte, o te digo qué falta.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGERIDAS.map((s) => (
                      <button key={s.q} className="presionable min-h-11 rounded-full border border-border bg-white px-2.5 py-1 text-left text-xs hover:border-tinta sm:min-h-0" onClick={() => preguntar(s.q)}>
                        {s.q}{s.etiqueta && <span className="ml-1 text-[10px] text-muted-foreground">({s.etiqueta})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turnos.map((t, iTurno) => t.voz ? (
                <p key={t.id} className={cn("rounded-md px-3 py-2", t.voz.quien === "persona" ? "ml-8 bg-tinta/10" : t.voz.quien === "sistema" ? "bg-[#fff8e1] text-xs text-[#7a5600]" : "mr-8 border border-border bg-white")}>
                  <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{t.voz.quien === "persona" ? "Tú (voz)" : t.voz.quien === "sistema" ? "Aviso" : "Jarvis"}</span>
                  {t.voz.texto}
                </p>
              ) : (
                <div key={t.id} className="space-y-2">
                  <p className="ml-8 rounded-md bg-tinta px-3 py-2 text-white">{t.pregunta}{t.ambito && <span className="block text-[10px] text-white/60">sobre este tema</span>}</p>
                  {t.error ? (
                    <div className="rounded-md border border-senal bg-[#fdecef] px-3 py-2 text-[#9b1526]" role="alert">
                      <p className="font-medium">No se pudo consultar</p>
                      <p className="text-xs">{t.error}</p>
                      <button className="presionable mt-1 text-xs underline" onClick={() => preguntar(t.pregunta, t.id)}>Reintentar</button>
                    </div>
                  ) : !t.respuesta ? (
                    <TrazaBuscando modo={modoConsulta} />
                  ) : null}
                  {t.error || !t.respuesta ? null : t.respuesta.conversacion ? (
                    <div className="mr-8 rounded-md border border-border bg-white px-3 py-2">
                      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Jarvis</span>
                      <p>{t.respuesta.conversacion.texto}</p>
                      {t.respuesta.guia && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {t.respuesta.guia.paso && <span className="text-[11px] text-muted-foreground">Paso {t.respuesta.guia.paso} de {t.respuesta.guia.total}</span>}
                          <button className="presionable min-h-9 rounded-full border border-border bg-white px-2.5 text-xs hover:border-tinta" onClick={() => { setCartel({ ...t.respuesta!.guia!, desdeChat: true }); void mostrarGuia(t.respuesta!.guia!); }}>Mostrar de nuevo</button>
                          {t.respuesta.guia.siguiente && <button className="presionable min-h-9 rounded-full bg-tinta px-3 text-xs font-medium text-white" onClick={() => preguntar(`__guia:${t.respuesta!.guia!.siguiente}`, undefined, `Siguiente: ${t.respuesta!.guia!.siguienteTitulo}`)}>Siguiente: {t.respuesta.guia.siguienteTitulo} →</button>}
                        </div>
                      )}
                      {t.respuesta.conversacion.sugerencias.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.respuesta.conversacion.sugerencias.map((s) => <button key={s} className="presionable min-h-11 rounded-full border border-border bg-white px-2.5 py-1 text-left text-xs hover:border-tinta sm:min-h-0" onClick={() => preguntar(s)}>{s}</button>)}
                        </div>
                      )}
                    </div>
                  ) : t.respuesta.abstener ? (
                    <div className="rounded-md border border-border bg-papel px-3 py-2">
                      <p className="font-medium">Sin respuesta sustentada</p>
                      <p className="text-muted-foreground">{t.respuesta.motivo}</p>
                      {t.respuesta.faltante && <p className="mt-1"><span className="font-medium">Qué falta:</span> {t.respuesta.faltante}</p>}
                    </div>
                  ) : t.respuesta.agenda ? (
                    <div className="mr-4 rounded-md border border-border bg-white px-3 py-2.5">
                      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Jarvis · agenda de hoy</span>
                      <p className="leading-relaxed">{t.respuesta.agenda.uno ? "La que más merece revisión hoy:" : "Hoy la mesa prioriza estos temas:"}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">El puntaje mide atención, no verdad; la evidencia dice si ya se puede escribir.</p>
                      <ol className="mt-2 space-y-1.5">
                        {t.respuesta.agenda.items.map((x, i) => (
                          <li key={x.eventoId}>
                            <button className="presionable flex w-full items-start gap-2 rounded-md border border-border bg-papel/60 px-2.5 py-2 text-left hover:border-tinta" onClick={() => { if (celular) setChatAbierto(false); irA("ficha", x.eventoId); }}>
                              <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-tinta text-[11px] font-semibold text-white">{i + 1}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium leading-snug">{x.titulo}</span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground"><span className={cn(x.medio === "TVN" && "font-semibold text-azul")}>{x.medio}</span> · atención {x.P}/100 · evidencia {x.evidencia}{x.publicaciones > 1 ? ` · ${x.publicaciones} publicaciones` : ""}</span>
                              </span>
                              <span className="mt-0.5 text-xs text-acero" aria-hidden>→</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-[11px] text-muted-foreground">Toca un tema para abrir su ficha.</p>
                    </div>
                  ) : (
                    <RespuestaClara r={t.respuesta} onCita={setCita} onFicha={enFicha ? undefined : () => abrirFichaDe(t.respuesta!.evidencias.find((e) => e.tipo === "noticia")!.id)} />
                  )}
                  {/* la traza va después de la respuesta: primero lo que sirve, después cómo se buscó */}
                  {t.respuesta?.traza && !t.respuesta.conversacion && !(celular && t.respuesta.traza.regla) && <TrazaBusqueda traza={t.respuesta.traza} llmMs={t.respuesta.redaccion?.llm.ms} abierta={!celular && (iTurno === turnos.length - 1 || turnos.slice(iTurno + 1).every((x) => x.voz))} />}
                  {t.respuesta && t.respuesta.contradicciones.length > 0 && <p className="rounded-sm bg-[#fdecef] px-3 py-1.5 text-xs text-[#9b1526]">{t.respuesta.contradicciones.length} contradicción(es) abierta(s) entre las fuentes: {t.respuesta.contradicciones.map((c) => c.detalle).join("; ")}</p>}
                  {t.respuesta && !t.respuesta.conversacion && turnos.slice(iTurno + 1).every((x) => x.voz) && <p className="text-[10.5px] text-muted-foreground">Solo titulares y datos del corte; no se leyó la nota completa.</p>}
                </div>
              ))}
              <div ref={fin} />
            </div>
            <form className="flex items-end gap-2 border-t border-border/60 p-3" onSubmit={(e) => { e.preventDefault(); preguntar(q); }}>
              <textarea ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); preguntar(q); } }} rows={2} placeholder="Escribe tu pregunta" className="min-h-[44px] flex-1 resize-none rounded-sm border border-border bg-white px-3 py-2 text-base sm:text-sm" aria-label="Pregunta para el agente" />
              <button
                type="button"
                className="jarvis-hablar presionable flex h-11 min-w-11 items-center gap-1.5 rounded-sm border border-tinta/30 bg-white px-2 text-xs font-medium text-tinta"
                aria-pressed={activa}
                aria-label={activa ? `Colgar a Jarvis. ${ETIQUETA_ORBE[orbe]}` : "Hablar con Jarvis"}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => { voz.prepararAudio(); void voz.alternar(); }}
              >
                <Orbe estado={orbe} nivel={voz.nivel} />
                <span className={cn(!celular && tamano === "compacto" && "sr-only")}>{activa ? "Colgar" : "Hablar"}</span>
              </button>
              <button type="submit" disabled={ocupado || !q.trim()} className="presionable h-11 rounded-sm bg-azul px-3 text-sm font-medium text-white disabled:opacity-50" aria-busy={ocupado}>{ocupado ? "Buscando…" : "Preguntar"}</button>
            </form>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cartel && (
          <motion.div key={`${cartel.parte ?? cartel.titulo}-${cartel.paso ?? 0}`} className="guia-cartel rounded-md border border-azul/30 bg-white px-4 py-3 text-sm shadow-[0_18px_40px_-18px_rgba(0,70,111,.55)]" role="status" aria-live="polite"
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-block size-2.5 flex-none rounded-full bg-azul" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-tinta">{cartel.titulo}{cartel.paso ? <span className="ml-2 text-xs font-normal text-muted-foreground">paso {cartel.paso} de {cartel.total}</span> : null}</p>
                {cartel.texto && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{cartel.texto}</p>}
                {cartel.desdeChat && cartel.siguiente && <button className="presionable mt-2 min-h-9 rounded-full bg-tinta px-3 text-xs font-medium text-white" onClick={() => preguntar(`__guia:${cartel.siguiente}`, undefined, `Siguiente: ${cartel.siguienteTitulo}`)}>Siguiente: {cartel.siguienteTitulo} →</button>}
              </div>
              <button className="presionable -mr-1 min-h-9 min-w-9 rounded-sm text-muted-foreground hover:bg-papel" onClick={() => setCartel(null)} aria-label="Cerrar la explicación">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Citas id={cita} pubs={evidencia.pubs} inds={evidencia.inds} sismos={evidencia.sismos} onCerrar={() => setCita(null)} />
    </>
  );
}

/** Respuesta en un párrafo directo con citas numeradas y, debajo, sus fuentes (TVN primero). Las frases que no son un hecho
 *  reportado (declaración, inferencia, hipótesis) lo dicen. Lo que falta verificar, corto. */
const TIPO: Record<string, string> = { declaracion: "declaración", inferencia: "inferencia", hipotesis: "por verificar" };
function RespuestaClara({ r, onCita, onFicha }: { r: Respuesta; onCita: (id: string) => void; onFicha?: () => void }) {
  const frases = r.redaccion?.frases ?? r.afirmaciones;
  const ids = [...new Set([...frases.map((f) => f.evidence_id), ...r.evidencias.map((e) => e.id)])];
  const resumen = new Map(r.evidencias.map((e) => [e.id, e.resumen]));
  const fuentes = ids.map((id) => ({ id, texto: resumen.get(id) ?? id })).sort((a, b) => Number(b.texto.startsWith("TVN ·")) - Number(a.texto.startsWith("TVN ·")));
  const n = new Map(fuentes.map((f, i) => [f.id, i + 1]));
  const vacios = r.redaccion?.vacios ?? [];
  return (
    <div className="mr-4 rounded-md border border-border bg-white px-3 py-2.5">
      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Jarvis</span>
      <p className="leading-relaxed">
        {frases.map((f, i) => (
          <span key={i}>
            {f.texto}{TIPO[f.tipo] && <span className="ml-1 text-[10.5px] text-muted-foreground">({TIPO[f.tipo]})</span>}
            {frases[i + 1]?.evidence_id !== f.evidence_id && <button type="button" onClick={() => onCita(f.evidence_id)} className="presionable mx-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-acero/40 bg-white px-1 align-text-top text-[10.5px] font-semibold text-acero hover:bg-acero hover:text-white" aria-label={`Ver la fuente ${n.get(f.evidence_id)}`}>{n.get(f.evidence_id)}</button>}{" "}
          </span>
        ))}
      </p>
      <p className="mt-2.5 text-[11px] font-medium text-muted-foreground">Fuentes</p>
      <ol className="mt-1 space-y-1">
        {fuentes.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onCita(f.id)} className="presionable flex w-full items-start gap-2 rounded-sm px-1 py-1 text-left text-xs hover:bg-papel">
              <span className="mt-px flex size-5 flex-none items-center justify-center rounded-full border border-acero/40 text-[10.5px] font-semibold text-acero">{n.get(f.id)}</span>
              <span className="min-w-0 flex-1"><span className={cn("font-medium", f.texto.startsWith("TVN ·") && "text-azul")}>{f.texto.split(" · ")[0]}</span>{f.texto.includes(" · ") && <span className="text-muted-foreground"> · {f.texto.split(" · ").slice(1).join(" · ")}</span>}</span>
            </button>
          </li>
        ))}
      </ol>
      {vacios.length > 0 && <p className="mt-2 text-xs text-[#7a5600]"><span className="font-medium">Lo que la fuente no dice:</span> {vacios[0].replace(/[.;\s]+$/, "")}.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onFicha && r.evidencias.some((e) => e.tipo === "noticia") && <button className="presionable min-h-9 rounded-full border border-tinta/30 bg-white px-3 text-xs font-medium text-tinta hover:border-tinta" onClick={onFicha}>Abrir la ficha →</button>}
        <span className="text-[10.5px] text-muted-foreground">{r.redaccion ? <span title={`${nombreModelo(r.redaccion.llm.modelo)}, ${Math.round(r.redaccion.llm.ms / 1000)} s`}>Borrador de IA, solo con estas fuentes. Revísalo antes de usarlo.</span> : "Tomado de las fuentes, sin redacción de IA."}</span>
      </div>
    </div>
  );
}
