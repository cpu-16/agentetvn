"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Medidor, type Componentes } from "./medidor";
import { Chips, type EventoResumen } from "./agenda";
import { BotonCita, Citas, type Indicador, type Publicacion, type Sismo } from "./citas";
import { PaqueteYRevision, type Afirmacion, type Paquete, type Revision, type RevisionHist } from "./paquete";
import { ESTADO_LABEL, horaPanama, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";

interface Evento extends Omit<EventoResumen, "titulo" | "medio" | "publicaciones" | "estado_revision"> {
  representante: string; ids_noticia: string[]; tema_confianza: number; contexto: { indicadores: string[]; sismos: string[] }; contradicciones: { a: string; b: string; campo: string; detalle: string }[]; componentes: Componentes;
}
interface Detalle { evento: Evento; publicaciones: Publicacion[]; indicadores: Indicador[]; sismos: Sismo[]; revision: Revision; historial: RevisionHist[]; paquete: Paquete | null }
interface Respuesta { abstener: boolean; motivo?: string; faltante?: string; afirmaciones: Afirmacion[]; evidencias: { id: string; tipo: string; resumen: string; score: number }[]; contradicciones: { detalle: string }[]; modo: string; ms: number; leyenda: string }

function accionRecomendada(e: Evento): string {
  if (e.no_confiable) return "Tratar el contenido marcado como no confiable: no se usa en el borrador ni en la consulta.";
  if (e.contradicciones.length) return "Resolver la contradicción con una fuente primaria antes de redactar; mostrar ambas versiones mientras tanto.";
  if (e.estado_evidencia === "insuficiente") return e.rango === "alto" ? "Investigar: prioridad alta con evidencia insuficiente. Conseguir fuente primaria o segunda procedencia independiente." : "Monitorear: evidencia insuficiente y prioridad no alta.";
  if (e.estado_evidencia === "parcial") return "Preparar borrador con lo citado y completar las verificaciones pendientes antes de aprobarlo.";
  return "Evidencia suficiente para el borrador. La aprobación sigue siendo humana y no publica.";
}

export function Ficha({ id }: { id: string }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [resp, setResp] = useState<Respuesta | null>(null);
  const [consultando, setConsultando] = useState(false);
  const { irA, rol, modoConsulta, setModoConsulta } = useMesa();

  const cargar = useCallback(() => {
    fetch(`/api/eventos/${id}`).then(async (r) => {
      if (!r.ok) throw new Error(r.status === 404 ? "Ese tema no existe en el snapshot." : `No cargó la ficha (${r.status}).`);
      setD(await r.json());
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(cargar, [cargar]);

  const preguntar = async () => {
    if (!q.trim()) return;
    setConsultando(true);
    const r = await fetch("/api/consulta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, modo: modoConsulta, eventoId: id }) });
    setResp(r.ok ? await r.json() : { abstener: true, motivo: `La consulta falló (${r.status}).`, afirmaciones: [], evidencias: [], contradicciones: [], modo: modoConsulta, ms: 0, leyenda: "" });
    setConsultando(false);
  };

  if (error) return <div><Button variant="ghost" onClick={() => irA("agenda")}>Volver a la agenda</Button><p className="mt-3 text-sm">{error}</p></div>;
  if (!d) return <p className="p-4 text-sm text-muted-foreground">Cargando la ficha…</p>;
  const { evento: e, publicaciones: pubs } = d;
  const rep = pubs.find((p) => p.id_noticia === e.representante) ?? pubs[0];
  const porId = new Map(pubs.map((p) => [p.id_noticia, p]));
  const resumen: EventoResumen = { ...e, titulo: rep?.titulo ?? "", medio: rep?.medio ?? "", publicaciones: pubs.length, estado_revision: d.revision.estado };
  const faltas: string[] = [];
  if (e.contradicciones.length) faltas.push(...e.contradicciones.map((c) => `Contradicción: ${c.detalle}. Verificación pendiente.`));
  for (const p of e.procedencias.filter((p) => p.tipo === "no_verificada")) faltas.push(`${p.ids_noticia.length} publicación(es) con titular copiado y sin agencia: independencia no verificada.`);
  if (pubs.every((p) => !p.fecha_publicacion)) faltas.push("Ninguna publicación trae fecha de publicación; solo hay fecha de detección.");
  if (!d.indicadores.length && !d.sismos.length) faltas.push("Sin dato oficial ligado: conseguir fuente primaria.");
  faltas.push("Todo se basa únicamente en titular/metadatos: leer la nota completa.");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => irA("agenda")}>Agenda</Button>
        <span className="text-muted-foreground">/ Ficha {e.id}</span>
        <span className="ml-auto text-xs text-muted-foreground">Revisión: {ESTADO_LABEL[d.revision.estado]}</span>
      </div>
      <h1 className="titular text-2xl font-semibold leading-tight sm:text-3xl">{rep?.titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rep?.medio}, {e.fecha_original ? `publicado ${horaPanama(e.fecha_original)}` : "sin fecha de publicación (solo detección)"}</p>
      <div className="mt-2"><Chips e={resumen} /></div>

      <Tabs defaultValue={rol === "productor" ? "paquete" : "evidencia"} className="mt-5">
        <TabsList className="h-9 rounded-sm bg-white">
          <TabsTrigger value="evidencia">Evidencia</TabsTrigger>
          <TabsTrigger value="paquete">Paquete y revisión</TabsTrigger>
        </TabsList>
        <TabsContent value="evidencia" className="mt-4">
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
                      <p className="font-medium">{p.tipo === "agencia" ? `Agencia ${p.nombre}` : p.tipo === "no_verificada" ? "Independencia no verificada" : p.tipo === "primaria" ? `Fuente primaria ${p.nombre}` : `Medio ${p.nombre}`} <span className="text-muted-foreground">({p.ids_noticia.length})</span></p>
                      <ul className="mt-1 space-y-1 text-xs">
                        {p.ids_noticia.map((nid) => {
                          const n = porId.get(nid);
                          return n ? <li key={nid}>{n.medio}: {n.titulo} <BotonCita id={nid} onAbrir={setCita} />{n.no_confiable && <span className="chip rojo ml-1">no confiable</span>}</li> : null;
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Bloque>

              <Bloque titulo="Qué está respaldado">
                {!d.indicadores.length && !d.sismos.length && <p className="text-sm text-muted-foreground">Sin relación sustentada con datos oficiales. No se fuerza un vínculo.</p>}
                {d.indicadores.map((i) => (
                  <p key={`${i.indicador_id}${i.anio}`} className="text-sm">{i.pais_iso3}, {i.indicador_id}, {i.anio}: <span className="font-medium">{i.valor} {i.unidad}</span> (Banco Mundial, {i.licencia}). <span className="text-[#7a5600]">Contexto histórico, no dato de hoy.</span><BotonCita id={`${i.pais_iso3}:${i.indicador_id}:${i.anio}`} campo="valor" onAbrir={setCita} /></p>
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
              <div className="rounded-sm border border-border bg-white p-4">
                <h2 className="titular text-lg font-semibold">Preguntar sobre este tema</h2>
                <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} placeholder="¿Cuál fue la inflación de Panamá en 2024?" className="mt-2 w-full rounded-sm border border-border p-2 text-sm" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={preguntar} disabled={consultando} variant={rol === "periodista" ? "default" : "outline"}>{consultando ? "Buscando…" : "Preguntar"}</Button>
                  <select value={modoConsulta} onChange={(e) => setModoConsulta(e.target.value as "embeddings" | "bm25")} className="h-8 rounded-sm border border-border px-2 text-xs">
                    <option value="embeddings">Semántica (embeddings)</option>
                    <option value="bm25">Léxica (BM25, baseline)</option>
                  </select>
                </div>
                {resp && (
                  <div className="mt-3 text-sm">
                    <p className="text-[11px] text-muted-foreground">Modo {resp.modo}, {resp.ms} ms</p>
                    {resp.abstener ? (
                      <div className="mt-1 rounded-sm bg-papel p-3 text-muted-foreground">
                        <p className="font-medium text-foreground">Sin respuesta sustentada.</p>
                        <p>{resp.motivo}</p>
                        {resp.faltante && <p className="mt-1">Haría falta: {resp.faltante}</p>}
                      </div>
                    ) : (
                      <ul className="mt-1 space-y-2">
                        {resp.afirmaciones.map((a, i) => <li key={i} className={cn("bg-papel px-3 py-2", `tipo-${a.tipo}`)}>{a.texto}<BotonCita id={a.evidence_id} campo={a.campo} onAbrir={setCita} /></li>)}
                      </ul>
                    )}
                    {resp.contradicciones.length > 0 && <p className="mt-2 text-xs text-senal">Hay {resp.contradicciones.length} contradicción(es) abierta(s) en estas fuentes.</p>}
                    {resp.leyenda && <p className="mt-2 text-[11px] text-muted-foreground">{resp.leyenda}</p>}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="paquete" className="mt-4">
          <PaqueteYRevision eventoId={id} paquete={d.paquete} revision={d.revision} historial={d.historial} onCita={setCita} onCambio={cargar} />
        </TabsContent>
      </Tabs>
      <Citas id={cita} pubs={pubs} inds={d.indicadores} sismos={d.sismos} onCerrar={() => setCita(null)} />
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-tinta pt-3">
      <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}
