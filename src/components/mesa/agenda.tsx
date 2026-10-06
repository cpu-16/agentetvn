"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Medidor, type Componentes } from "./medidor";
import { itemEscalonado } from "./motion";
import { ESTADO_LABEL, EVIDENCIA_LABEL, TEMA_LABEL, horaPanama, useMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";

export interface EventoResumen {
  id: string; titulo: string; medio: string; tema: string; por_revisar: boolean; P: number; rango: "bajo" | "medio" | "alto";
  componentes: Componentes; estado_evidencia: "insuficiente" | "parcial" | "suficiente"; estado_revision: string;
  procedencias: { id: string; tipo: string; nombre: string; ids_noticia: string[] }[]; publicaciones: number; fecha_original: string | null;
  contradicciones: unknown[]; sintetica?: boolean; no_confiable: boolean; ids_noticia: string[];
}
interface Agenda { corteUTC: string; version: string; eventos: EventoResumen[]; cinco: { evento: EventoResumen; razones: string[]; vacios: string[] }[] }

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

export function Agenda({ onCargada }: { onCargada?: (a: { corteUTC: string; version: string }) => void }) {
  const [data, setData] = useState<Agenda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tema, setTema] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [q, setQ] = useState("");
  const [verCinco, setVerCinco] = useState(true);
  const irA = useMesa((s) => s.irA);
  const reducir = useReducedMotion();
  const [animarEntrada, setAnimarEntrada] = useState(true); // el escalonado solo la primera vez, no al filtrar

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setAnimarEntrada(false), 1200);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    fetch("/api/agenda").then(async (r) => {
      if (!r.ok) throw new Error(`La agenda no cargó (${r.status}).`);
      const a = (await r.json()) as Agenda;
      setData(a);
      onCargada?.({ corteUTC: a.corteUTC, version: a.version });
    }).catch((e) => setError(e.message));
  }, [onCargada]);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return data.eventos.filter((e) => (tema === "todos" || e.tema === tema) && (estado === "todos" || e.estado_revision === estado) && (!t || e.titulo.toLowerCase().includes(t) || e.medio.toLowerCase().includes(t)));
  }, [data, tema, estado, q]);

  if (error) return <p className="rounded-sm border border-senal bg-white p-4 text-sm">{error} Revisa que el snapshot esté en data/processed y corre bun run motor.</p>;
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Cargando la agenda…</p>;
  const temas = [...new Set(data.eventos.map((e) => e.tema))];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h1 className="text-2xl font-semibold">Agenda del día</h1>
          <p className="text-sm text-muted-foreground">{data.eventos.length} temas ordenados por puntaje de atención. Corte {horaPanama(data.corteUTC)}</p>
        </div>
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar titular o medio" className="h-9 w-full rounded-sm border border-border bg-white px-3 sm:w-64" />
          <select value={tema} onChange={(e) => setTema(e.target.value)} className="h-9 rounded-sm border border-border bg-white px-2">
            <option value="todos">Todos los temas</option>
            {temas.map((t) => <option key={t} value={t}>{TEMA_LABEL[t] ?? t}</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 rounded-sm border border-border bg-white px-2">
            <option value="todos">Cualquier estado</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="escaleta rounded-sm border border-border bg-papel">
          {filtrados.length === 0 && <p className="p-6 text-sm text-muted-foreground">Ningún tema coincide con el filtro. Quita un filtro o cambia la búsqueda.</p>}
          {filtrados.map((e, i) => (
            <motion.div key={e.id} role="button" tabIndex={0} className="fila presionable cursor-pointer" onClick={() => irA("ficha", e.id)} onKeyDown={(k) => k.key === "Enter" && irA("ficha", e.id)} {...(animarEntrada ? itemEscalonado(i, reducir) : {})}>
              <div>
                <Medidor P={e.P} rango={e.rango} componentes={e.componentes} />
                <p className="mt-1 text-[11px] text-muted-foreground">#{i + 1}</p>
              </div>
              <div className="min-w-0">
                <h2 className="titular text-[17px] font-semibold leading-snug">{e.titulo}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{e.medio}, {e.fecha_original ? `publicado ${horaPanama(e.fecha_original)}` : "sin fecha de publicación (solo detección)"}</p>
                <div className="mt-2 lg:hidden"><Chips e={e} /></div>
              </div>
              <div className="hidden lg:block">
                <Chips e={e} />
                <p className="mt-2 text-xs">{ESTADO_LABEL[e.estado_revision] ?? e.estado_revision}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      <aside className="lg:sticky lg:top-16 lg:self-start">
        <div className="rounded-sm border border-tinta bg-white">
          <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setVerCinco((v) => !v)}>
            <span className="titular text-lg font-semibold">Cinco para hoy</span>
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
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Pregunta del reto CU-01. El puntaje ordena; la evidencia decide si se puede escribir.</p>
        </div>
      </aside>
    </div>
  );
}
