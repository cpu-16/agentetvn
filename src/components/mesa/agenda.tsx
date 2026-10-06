"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Desglose, Medidor } from "./medidor";
import type { EventoResumen } from "./tipos";
import { itemEscalonado } from "./motion";
import { ESTADO_LABEL, EVIDENCIA_LABEL, TEMA_LABEL, horaPanama, useMesa } from "@/store/mesa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { EventoResumen } from "./tipos";

const evidenciaClase = { insuficiente: "rojo", parcial: "ambar", suficiente: "verde" } as const;

export function Chips({ e, compacto = false }: { e: EventoResumen; compacto?: boolean }) {
  const noVer = e.procedencias.find((p) => p.tipo === "no_verificada");
  const M = e.procedencias.filter((p) => p.tipo !== "no_verificada").length;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cn("chip", e.por_revisar && "ambar")}>{TEMA_LABEL[e.tema] ?? e.tema}{e.por_revisar ? ", por revisar" : ""}</span>
      <span className={cn("chip", evidenciaClase[e.estado_evidencia])}>{EVIDENCIA_LABEL[e.estado_evidencia]}</span>
      {!compacto && <span className="chip gris">{e.publicaciones} {e.publicaciones === 1 ? "publicación" : "publicaciones"}, {M} {M === 1 ? "procedencia" : "procedencias"}</span>}
      {noVer && <span className="chip ambar">{noVer.ids_noticia.length} sin independencia verificada</span>}
      {e.contradicciones.length > 0 && <span className="chip rojo">{e.contradicciones.length} contradicción{e.contradicciones.length > 1 ? "es" : ""}</span>}
      {e.sintetica && <span className="chip tinta">Caso sintético</span>}
      {e.no_confiable && <span className="chip rojo">Contenido no confiable</span>}
    </div>
  );
}

export function Agenda() {
  const data = useMesa((s) => s.agenda);
  const error = useMesa((s) => s.agendaError);
  const cargarAgenda = useMesa((s) => s.cargarAgenda);
  const irA = useMesa((s) => s.irA);
  const filtroTablero = useMesa((s) => s.filtroTablero);
  const setFiltroTablero = useMesa((s) => s.setFiltroTablero);
  const [tema, setTema] = useState(filtroTablero?.temas[0] ?? "todos");
  const [estado, setEstado] = useState("todos");
  const [q, setQ] = useState("");
  const [verCinco, setVerCinco] = useState(true);
  const reducir = useReducedMotion();
  const [animarEntrada, setAnimarEntrada] = useState(true); // el escalonado solo la primera vez, no al filtrar
  const idBase = useId();

  useEffect(() => { void cargarAgenda(); }, [cargarAgenda]);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setAnimarEntrada(false), 1200);
    return () => clearTimeout(t);
  }, [data]);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return data.eventos.filter((e) => (tema === "todos" || e.tema === tema) && (estado === "todos" || e.estado_revision === estado) && (!t || e.titulo.toLowerCase().includes(t) || e.medio.toLowerCase().includes(t)));
  }, [data, tema, estado, q]);

  if (error) return <div className="flex flex-wrap items-center gap-3 rounded-sm border border-senal bg-white p-4 text-sm" role="alert"><p>{error}</p><Button size="sm" variant="outline" onClick={() => cargarAgenda(true)}>Reintentar</Button></div>;
  if (!data) return <p className="p-4 text-sm text-muted-foreground" aria-live="polite">Cargando la agenda…</p>;
  const temas = [...new Set(data.eventos.map((e) => e.tema))];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section aria-labelledby={`${idBase}-titulo`}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h1 id={`${idBase}-titulo`} className="text-2xl font-semibold">Agenda del día</h1>
          <p className="text-sm text-muted-foreground">{data.eventos.length} temas ordenados por puntaje de atención. Corte de esta mañana: {horaPanama(data.corteUTC)}</p>
        </div>
        <div className="mb-2 flex flex-wrap gap-2 text-sm" role="search" aria-label="Filtrar la agenda">
          <label className="sr-only" htmlFor={`${idBase}-q`}>Buscar titular o medio</label>
          <input id={`${idBase}-q`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar titular o medio" className="h-9 w-full rounded-sm border border-border bg-white px-3 sm:w-64" />
          {filtroTablero && <button type="button" className="presionable chip tinta" onClick={() => { setFiltroTablero(null); setTema("todos"); }}>Filtro del tablero <span aria-hidden="true">×</span><span className="sr-only">, quitar</span></button>}
          <label className="sr-only" htmlFor={`${idBase}-tema`}>Tema</label>
          <select id={`${idBase}-tema`} value={tema} onChange={(e) => { setTema(e.target.value); if (filtroTablero) setFiltroTablero(null); }} className="h-9 rounded-sm border border-border bg-white px-2">
            <option value="todos">Todos los temas</option>
            {temas.map((t) => <option key={t} value={t}>{TEMA_LABEL[t] ?? t}</option>)}
          </select>
          <label className="sr-only" htmlFor={`${idBase}-estado`}>Estado de revisión</label>
          <select id={`${idBase}-estado`} value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 rounded-sm border border-border bg-white px-2">
            <option value="todos">Cualquier estado</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="sr-only" aria-live="polite">{filtrados.length} temas en la lista</p>
        <ol className="escaleta rounded-sm border border-border bg-papel" aria-label="Temas ordenados por puntaje">
          {filtrados.length === 0 && <li className="p-6 text-sm text-muted-foreground">Ningún tema coincide con el filtro. Quita un filtro o cambia la búsqueda.</li>}
          {filtrados.map((e, i) => (
            <motion.li key={e.id} className="fila" {...(animarEntrada ? itemEscalonado(i, reducir) : {})}>
              <div>
                <Medidor P={e.P} rango={e.rango} componentes={e.componentes} />
                <p className="mt-1 text-[11px] text-muted-foreground">#{i + 1}</p>
                <details className="encima mt-1 text-[11px]">
                  <summary className="cursor-pointer text-acero">Por qué este puntaje</summary>
                  <Desglose componentes={e.componentes} className="mt-1 max-w-xs text-muted-foreground" />
                </details>
              </div>
              <div className="min-w-0">
                <button type="button" className="fila-abrir presionable block text-left" onClick={() => irA("ficha", e.id)}>
                  <span className="titular block text-[17px] font-semibold leading-snug">{e.titulo}</span>
                  <span className="sr-only">. Abrir la ficha</span>
                </button>
                <p className="mt-0.5 text-xs text-muted-foreground">{e.medio}, {e.fecha_original ? `publicado ${horaPanama(e.fecha_original)}` : "sin fecha de publicación (solo detección)"}</p>
                <div className="mt-2 lg:hidden"><Chips e={e} /></div>
              </div>
              <div className="hidden lg:block">
                <Chips e={e} />
                <p className="mt-2 text-xs">{ESTADO_LABEL[e.estado_revision] ?? e.estado_revision}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>
      <aside className="lg:sticky lg:top-16 lg:self-start" aria-labelledby={`${idBase}-cinco`}>
        <div className="rounded-sm border border-tinta bg-white">
          <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setVerCinco((v) => !v)} aria-expanded={verCinco}>
            <span id={`${idBase}-cinco`} className="titular text-lg font-semibold">Cinco para hoy</span>
            <span className="text-xs text-muted-foreground">{verCinco ? "Ocultar" : "Mostrar"}</span>
          </button>
          {verCinco && (
            <ol className="escaleta border-t border-border">
              {data.cinco.map((c, i) => (
                <li key={c.evento.id} className="px-4 py-3">
                  <button className="presionable text-left" onClick={() => irA("ficha", c.evento.id)}>
                    <span className="titular text-[15px] font-semibold leading-snug">{i + 1}. {c.evento.titulo}</span>
                  </button>
                  <div className="mt-1.5"><Chips e={c.evento} compacto /></div>
                  <details className="mt-1.5 text-xs">
                    <summary className="cursor-pointer text-acero">Por qué y qué falta</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {c.razones.map((r, j) => <li key={j}>{r}</li>)}
                    </ul>
                    <p className="mt-1 font-medium">Vacíos</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {c.vacios.map((v, j) => <li key={j}>{v}</li>)}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          )}
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Cinco temas para la agenda de Panamá (CU-01). El puntaje ordena; la evidencia decide si se puede escribir.</p>
        </div>
      </aside>
    </div>
  );
}
