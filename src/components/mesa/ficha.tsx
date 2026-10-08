"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Medidor, type Componentes } from "./medidor";
import { Chips, type EventoResumen } from "./agenda";
import { BotonCita, Citas, type Indicador, type Publicacion, type Sismo } from "./citas";
import { PaqueteYRevision, type Afirmacion, type Paquete, type Revision, type RevisionHist } from "./paquete";
import { ESTADO_LABEL, SPRING, fetchMesa, horaPanama, useMesa, useRol } from "@/store/mesa";
import { BancaYRevision } from "./banca";
import { Recorrido } from "./recorrido";
import { nombreMedio } from "@/lib/medios";
import { MESA } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Evento extends Omit<EventoResumen, "titulo" | "medio" | "publicaciones" | "estado_revision"> {
  representante: string; ids_noticia: string[]; tema_confianza: number; contexto: { indicadores: string[]; sismos: string[] }; contradicciones: { a: string; b: string; campo: string; detalle: string }[]; componentes: Componentes; primaria?: boolean;
}
interface Detalle { evento: Evento; falta_evidencia?: string[]; publicaciones: Publicacion[]; indicadores: Indicador[]; sismos: Sismo[]; revision: Revision; historial: RevisionHist[]; paquete: Paquete | null }

function accionRecomendada(e: Evento): string {
  if (e.no_confiable) return "Tratar el contenido marcado como no confiable: no se usa en el borrador ni en la consulta.";
  if (e.contradicciones.length) return "Resolver la contradicción con una fuente primaria antes de redactar; mostrar ambas versiones mientras tanto.";
  if (e.estado_evidencia === "insuficiente") return e.rango === "alto" ? "Investigar: prioridad alta con evidencia insuficiente. Conseguir fuente primaria o segunda procedencia independiente." : "Monitorear: evidencia insuficiente y prioridad no alta.";
  if (e.estado_evidencia === "parcial") return "Preparar borrador con lo citado y completar las verificaciones pendientes antes de aprobarlo.";
  return "Evidencia suficiente para el borrador. La aprobación sigue siendo humana y no publica.";
}

export function Ficha({ id }: { id: string }) {
  const rol = useRol();
  const [modalidad, setModalidad] = useState<"tvn" | "banca">(rol === "analista" ? "banca" : "tvn"); // el analista arma el boletín
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const irA = useMesa((s) => s.irA);
  const setChatAbierto = useMesa((s) => s.setChatAbierto);
  const actualizarEstadoEvento = useMesa((s) => s.actualizarEstadoEvento);
  const reducir = useReducedMotion();
  const [tab, setTab] = useState<"evidencia" | "paquete">(MESA[rol].pestana); // editor y periodista revisan la evidencia; productor y analista arman en el paquete
  const setPantalla = useMesa((s) => s.setPantalla);
  useEffect(() => setPantalla({ pestana: tab }), [tab, setPantalla]);
  // Jarvis puede cambiar de pestaña para mostrar el borrador o la evidencia (guía y recorrido)
  // (estado derivado durante el render, no en un efecto; las órdenes anteriores a montar la ficha no se aplican)
  const orden = useMesa((s) => s.orden);
  const [ordenVista, setOrdenVista] = useState(() => orden?.n ?? 0);
  if (orden && orden.n !== ordenVista) { setOrdenVista(orden.n); if (orden.tipo === "pestana") setTab(orden.pestana); }
  const tabs = useRef<HTMLButtonElement[]>([]);

  const cargar = useCallback(() => {
    fetchMesa(`/api/eventos/${id}`).then(async (r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "Ese tema no está en el corte de hoy." : "No se pudo cargar la ficha. Avisa al equipo técnico.");
      const detalle = (await r.json()) as Detalle;
      setD(detalle);
      actualizarEstadoEvento(id, detalle.revision.estado);
    }).catch((e) => setError(e instanceof TypeError ? "No hubo conexión. Revisa la red e intenta otra vez." : e.message));
  }, [id, actualizarEstadoEvento]);
  useEffect(cargar, [cargar]);
  const teclaTab = (e: React.KeyboardEvent, i: number) => {
    const orden = ["evidencia", "paquete"] as const;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const j = (i + (e.key === "ArrowRight" ? 1 : orden.length - 1)) % orden.length;
      setTab(orden[j]);
      tabs.current[j]?.focus();
    }
  };

  if (error) return <div role="alert"><Button variant="ghost" onClick={() => irA("agenda")}>Volver a la agenda</Button><p className="mt-3 text-sm">{error}</p><Button size="sm" variant="outline" className="mt-2" onClick={() => { setError(null); cargar(); }}>Reintentar</Button></div>;
  if (!d) return <p className="p-4 text-sm text-muted-foreground" aria-live="polite">Cargando la ficha…</p>;
  const { evento: e, publicaciones: pubs } = d;
  const rep = pubs.find((p) => p.id_noticia === e.representante) ?? pubs[0];
  const porId = new Map(pubs.map((p) => [p.id_noticia, p]));
  const resumen: EventoResumen = { ...e, titulo: rep?.titulo ?? "", medio: rep?.medio ?? "", publicaciones: pubs.length, estado_revision: d.revision.estado };
  const faltas: string[] = [...(d.falta_evidencia ?? [])]; // la misma línea que el paquete y la voz (regla de evidencia v2)
  if (e.contradicciones.length) faltas.push(...e.contradicciones.map((c) => `Contradicción: ${c.detalle}. Verificación pendiente.`));
  for (const p of e.procedencias.filter((p) => p.tipo === "no_verificada")) faltas.push(`${p.ids_noticia.length} publicación(es) con titular copiado y sin agencia: independencia no verificada.`);
  if (pubs.every((p) => !p.fecha_publicacion)) faltas.push("Ninguna publicación trae fecha de publicación; solo hay fecha de detección.");
  if (!d.indicadores.length && !d.sismos.length && !e.primaria) faltas.push("Sin dato oficial ligado (Banco Mundial o USGS).");
  faltas.push("Todo se basa únicamente en titular/metadatos: leer la nota completa.");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => irA("agenda")}>Agenda</Button>
        <span className="text-muted-foreground">/ Ficha <span className="font-mono text-xs">{e.id}</span></span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">Revisión editorial:
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={d.revision.estado} className="chip" initial={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }} transition={SPRING}>{ESTADO_LABEL[d.revision.estado]}</motion.span>
          </AnimatePresence>
        </span>
      </div>
      <h1 className="titular text-2xl font-semibold leading-tight sm:text-3xl">{rep?.titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rep ? nombreMedio(rep.medio) : ""}, {e.fecha_original ? `publicado ${horaPanama(e.fecha_original)}` : "sin fecha de publicación (solo detección)"}</p>
      <div className="mt-2"><Chips e={resumen} /></div>
      <Recorrido estado={d.revision.estado} rol={rol} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div data-guia="ficha-pestanas" data-evento={id} role="tablist" aria-label="Secciones de la ficha" className="relative inline-flex h-9 rounded-sm border border-border bg-white p-0.5">
          {(["evidencia", "paquete"] as const).map((t, i) => (
            <button key={t} ref={(el) => { if (el) tabs.current[i] = el; }} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1} onKeyDown={(e) => teclaTab(e, i)} onClick={() => setTab(t)} className={cn("presionable relative rounded-sm px-3 text-sm", tab === t ? "font-medium text-white" : "text-muted-foreground")}>
              {tab === t && <motion.span layoutId="tab-ficha" className="absolute inset-0 rounded-sm bg-tinta" transition={SPRING} aria-hidden />}
              <span className="relative">{t === "evidencia" ? "Evidencia" : "Paquete y revisión"}</span>
            </button>
          ))}
        </div>
        <Button size="sm" variant={rol === "periodista" ? "default" : "outline"} className="presionable" onClick={() => setChatAbierto(true)}>Preguntarle a Jarvis sobre este tema</Button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} id={`panel-${tab}`} data-guia={`ficha-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4" initial={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={reducir ? { opacity: 0 } : { opacity: 0, transform: "translateY(-2px)" }} transition={{ duration: 0.18 }}>
        {tab === "evidencia" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              <div className="rounded-sm border border-tinta bg-papel p-4">
                <h2 className="mb-2 text-lg font-semibold">Puntaje de atención (reglas v1)</h2>
                <Medidor P={e.P} rango={e.rango} componentes={e.componentes} grande conDetalle />
                <p className="mt-2 text-xs text-muted-foreground">Ordena la bandeja; no mide verdad ni autoriza publicar. Empates: urgencia, luego id.</p>
              </div>

              <Bloque titulo="Qué se reporta">
                <p className="text-sm">{rep?.titulo}<BotonCita id={rep?.id_noticia ?? ""} campo="titulo" onAbrir={setCita} /></p>
                {rep?.descripcion && <p className="mt-1 text-sm text-muted-foreground">{rep.descripcion}<BotonCita id={rep.id_noticia} campo="descripcion" onAbrir={setCita} /></p>}
              </Bloque>

              <Bloque titulo="Quién lo reporta">
                <p className="mb-2 text-sm text-muted-foreground">{pubs.length} {pubs.length === 1 ? "publicación" : "publicaciones"}, {e.procedencias.filter((p) => p.tipo !== "no_verificada").length} procedencia(s) identificada(s). Una agencia replicada cuenta una sola vez.</p>
                <ul className="space-y-2">
                  {e.procedencias.map((p) => (
                    <li key={p.id} className={cn("rounded-sm bg-white p-3 text-sm", p.tipo === "no_verificada" && "border border-ambar")}>
                      <p className="font-medium">{p.tipo === "agencia" ? `Agencia ${p.nombre}` : p.tipo === "no_verificada" ? "Independencia no verificada" : p.tipo === "primaria" ? `Fuente primaria ${p.nombre}` : `Medio ${nombreMedio(p.nombre)}`} <span className="text-muted-foreground">({p.ids_noticia.length})</span></p>
                      <ul className="mt-1 space-y-1 text-xs">
                        {p.ids_noticia.map((nid) => {
                          const n = porId.get(nid);
                          return n ? <li key={nid}>{nombreMedio(n.medio)}: {n.titulo} <BotonCita id={nid} onAbrir={setCita} />{n.no_confiable && <span className="chip rojo ml-1">no confiable</span>}</li> : null;
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Bloque>

              <Bloque titulo="Qué está respaldado">
                {!d.indicadores.length && !d.sismos.length && <p className="text-sm text-muted-foreground">Sin relación sustentada con datos oficiales. No se fuerza un vínculo.</p>}
                {d.indicadores.map((i) => (
                  <p key={`${i.indicador_id}${i.anio}`} className="text-sm">{i.pais_iso3}, {i.indicador_id}, {i.anio}: <span className="font-medium">{i.valor === null ? "nulo" : i.unidad === "personas" ? Math.round(i.valor).toLocaleString("es-PA") : (Math.round(i.valor * 100) / 100).toLocaleString("es-PA")} {i.unidad}</span> (Banco Mundial, {i.licencia}). <span className="text-[#7a5600]">Contexto histórico, no dato de hoy.</span><BotonCita id={`${i.pais_iso3}:${i.indicador_id}:${i.anio}`} campo="valor" onAbrir={setCita} /></p>
                ))}
                {d.sismos.map((s) => (
                  <p key={s.id} className="text-sm">Sismo M{s.magnitude}, {horaPanama(s.time)}, {s.place} (USGS). Solo prueba el hecho sísmico.<BotonCita id={s.id} campo="magnitude" onAbrir={setCita} /></p>
                ))}
              </Bloque>

              <Bloque titulo="Qué falta comprobar">
                <ul className="space-y-1 text-sm">
                  {faltas.map((f, i) => <li key={i} className={cn(f.startsWith("Contradicción") && "text-senal")}>{f}</li>)}
                </ul>
              </Bloque>

              <Bloque titulo="Acción recomendada">
                <p className="text-sm font-medium">{accionRecomendada(e)}</p>
              </Bloque>
            </section>

            <aside className="lg:sticky lg:top-16 lg:self-start">
              <div className="rounded-sm border border-border bg-white p-4 text-sm">
                <p className="titular text-lg font-semibold">Qué hacer con este tema</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  {PASOS_ROL[rol].map((x) => <li key={x}>{x}</li>)}
                </ol>
                <Button size="sm" variant="outline" className="presionable mt-3" onClick={() => setTab("paquete")}>Ir a Paquete y revisión</Button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-4">
            <div role="group" aria-label="Modalidad del borrador" className="flex gap-2">
              <Button size="sm" variant={modalidad === "tvn" ? "default" : "outline"} aria-pressed={modalidad === "tvn"} onClick={() => setModalidad("tvn")}>Editorial TVN</Button>
              <Button size="sm" variant={modalidad === "banca" ? "default" : "outline"} aria-pressed={modalidad === "banca"} onClick={() => setModalidad("banca")}>Análisis bancario</Button>
            </div>
            {/* oculto, no desmontado: cambiar de modalidad no borra lo que se estaba editando del paquete (revisión de Cursor) */}
            <div hidden={modalidad !== "tvn"}><PaqueteYRevision eventoId={id} paquete={d.paquete} revision={d.revision} historial={d.historial} onCita={setCita} onCambio={cargar} /></div>
            {modalidad === "banca" && <BancaYRevision key={id} eventoId={id} onCita={setCita} />}
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      <Citas id={cita} pubs={pubs} inds={d.indicadores} sismos={d.sismos} onCerrar={() => setCita(null)} />
    </div>
  );
}

// Qué hace cada rol con el tema, en el orden del flujo (lo pidió el editor del equipo: que cada uno sepa su siguiente paso)
const PASOS_ROL: Record<string, string[]> = {
  editor: ["Revisa el puntaje, quién lo reporta y qué falta comprobar.", "Abre las citas que sostienen lo que se reporta.", "En «Paquete y revisión»: tómalo, pide evidencia al periodista, descártalo o apruébalo como borrador."],
  periodista: ["Abre cada cita y confirma que respalda la afirmación.", "Busca lo que falta fuera del sistema (fuente primaria, segunda procedencia) y pregúntale a Jarvis por la cifra.", "En «Paquete y revisión», anota qué verificaste y devuélvelo al editor."],
  productor: ["Confirma que el editor ya lo aprobó como borrador.", "En «Paquete y revisión», elige un titular y revisa el guion y el copy con sus citas.", "Guarda tu edición y marca «Pieza lista»."],
  analista: ["Revisa la evidencia y el dato oficial ligado (Banco Mundial).", "En «Paquete y revisión», modalidad «Análisis bancario», genera el boletín de entorno.", "Confirma sus citas y apruébalo como borrador: no se publica."],
};

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-tinta pt-3">
      <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}
