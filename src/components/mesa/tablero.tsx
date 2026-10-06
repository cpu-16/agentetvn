"use client";
// Tablero: gráficas enlazadas sobre los agregados de /api/tablero. Un filtro compartido (temas, rango, período, medio) gobierna todo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMesa, horaPanama } from "@/store/mesa";
import { cn } from "@/lib/utils";
import { SenalesPorDia } from "./graficas/SenalesPorDia";
import { MapaTemas } from "./graficas/MapaTemas";
import { RelevanciaEvidencia } from "./graficas/RelevanciaEvidencia";
import { EvidenciaPorTema } from "./graficas/EvidenciaPorTema";
import { Medios, Procedencias } from "./graficas/MediosProcedencias";
import { ContextoOficial } from "./graficas/ContextoOficial";
import { SismosMapa, SismosPorMes } from "./graficas/Sismos";
import { nombreTema, fmt } from "./graficas/paleta";
import { FILTRO_VACIO, filtrarEventos, hayFiltro, type Filtro, type Tablero as DatosTablero } from "./graficas/tipos";

const RANGOS: { id: "alto" | "medio" | "bajo"; label: string }[] = [{ id: "alto", label: "Alto" }, { id: "medio", label: "Medio" }, { id: "bajo", label: "Bajo" }];
const dia = (d?: string) => (d ? new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)) : "");

function Cifra({ valor, etiqueta, detalle }: { valor: number; etiqueta: string; detalle?: string }) {
  return (
    <div className="rounded-sm border border-border bg-white px-4 py-3">
      <p className="font-display text-[34px] font-semibold leading-none tabular-nums">{fmt(valor)}</p>
      <p className="mt-1 text-sm text-foreground">{etiqueta}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

export function Tablero() {
  const [datos, setDatos] = useState<DatosTablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const irA = useMesa((s) => s.irA);
  const setFiltroTablero = useMesa((s) => s.setFiltroTablero);

  useEffect(() => {
    fetch("/api/tablero").then(async (r) => { if (!r.ok) throw new Error(`No se pudo cargar el tablero (${r.status}).`); setDatos(await r.json()); }).catch((e) => setError(e.message));
  }, []);

  const onFiltro = useCallback((f: Partial<Filtro>) => setFiltro((prev) => ({ ...prev, ...f })), []);
  const abrirFicha = useCallback((id: string) => irA("ficha", id), [irA]);
  const eventos = useMemo(() => (datos ? filtrarEventos(datos.eventos, filtro) : []), [datos, filtro]);
  const porDia = useMemo(() => {
    if (!datos) return [];
    return datos.porDiaTema.filter((d) => (!filtro.desde || d.dia >= filtro.desde) && (!filtro.hasta || d.dia <= filtro.hasta));
  }, [datos, filtro.desde, filtro.hasta]);

  if (error) return <div className="rounded-sm border border-senal/40 bg-white p-6 text-sm" role="alert">No se pudo cargar el tablero. Avisa al equipo técnico. <span className="text-muted-foreground">({error})</span></div>;
  if (!datos) return <div className="p-6 text-sm text-muted-foreground" aria-busy="true">Cargando el tablero…</div>;

  const mediosDistintos = new Set(eventos.map((e) => e.medio)).size;
  const suficientes = eventos.filter((e) => e.estado_evidencia === "suficiente").length;
  const publicaciones = eventos.reduce((s, e) => s + e.publicaciones, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none">Tablero de señales</h1>
          <p className="mt-1 text-sm text-muted-foreground">De dónde vienen las señales, cómo se reparten por tema y evidencia, y qué dicen los datos oficiales. Corte {horaPanama(datos.corteUTC)}.</p>
        </div>
        <button type="button" className="presionable rounded-sm bg-tinta px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!filtro.temas.length} onClick={() => { setFiltroTablero({ temas: filtro.temas }); irA("agenda"); }}>
          Ver estos {fmt(eventos.length)} temas en la agenda
        </button>
      </header>

      <section aria-label="Filtros activos" className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-white px-3 py-2 text-sm">
        <span className="text-muted-foreground">Rango</span>
        {RANGOS.map((r) => {
          const activo = filtro.rango.includes(r.id);
          return (
            <button key={r.id} type="button" aria-pressed={activo} className={cn("presionable chip", activo && "tinta")} onClick={() => onFiltro({ rango: activo ? filtro.rango.filter((x) => x !== r.id) : [...filtro.rango, r.id] })}>{r.label}</button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        {filtro.temas.map((t) => <button key={t} type="button" className="presionable chip" onClick={() => onFiltro({ temas: filtro.temas.filter((x) => x !== t) })}>{nombreTema(t)} <span aria-hidden="true">×</span><span className="sr-only">, quitar</span></button>)}
        {(filtro.desde || filtro.hasta) && <button type="button" className="presionable chip" onClick={() => onFiltro({ desde: undefined, hasta: undefined })}>{dia(filtro.desde)} a {dia(filtro.hasta)} <span aria-hidden="true">×</span><span className="sr-only">, quitar período</span></button>}
        {filtro.medio && <button type="button" className="presionable chip" onClick={() => onFiltro({ medio: undefined })}>{filtro.medio} <span aria-hidden="true">×</span><span className="sr-only">, quitar medio</span></button>}
        {!hayFiltro(filtro) && <span className="text-muted-foreground">Sin filtros: todo el corte. Arrastra en la línea de tiempo o haz clic en un tema o un medio.</span>}
        {hayFiltro(filtro) && <button type="button" className="presionable ml-auto text-xs text-acero underline" onClick={() => setFiltro(FILTRO_VACIO)}>Limpiar</button>}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Cifras del corte">
        <Cifra valor={publicaciones} etiqueta="publicaciones" detalle={hayFiltro(filtro) ? `de ${fmt(datos.eventos.reduce((s, e) => s + e.publicaciones, 0))}` : "en el corte"} />
        <Cifra valor={eventos.length} etiqueta="eventos agrupados" detalle={hayFiltro(filtro) ? `de ${fmt(datos.eventos.length)}` : "un hecho, varias publicaciones"} />
        <Cifra valor={mediosDistintos} etiqueta="medios principales" detalle="medio de la publicación representante" />
        <Cifra valor={suficientes} etiqueta="con evidencia suficiente" detalle={`${eventos.length ? Math.round((suficientes / eventos.length) * 100) : 0} % de los eventos`} />
      </section>

      <SenalesPorDia datos={porDia} filtro={filtro} onFiltro={onFiltro} />

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <MapaTemas eventos={eventos} filtro={filtro} onFiltro={onFiltro} abrirFicha={abrirFicha} />
        <RelevanciaEvidencia eventos={eventos} abrirFicha={abrirFicha} />
        <EvidenciaPorTema eventos={eventos} />
        <Medios medios={datos.medios} filtro={filtro} onFiltro={onFiltro} />
        <Procedencias procedencias={datos.procedencias} />
        <ContextoOficial indicadores={datos.indicadores} />
        <SismosMapa sismos={datos.sismos} />
        <SismosPorMes meses={datos.sismosPorMes} />
      </div>

      <section aria-label="Calidad del corte" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Cifra valor={datos.calidad.noticias} etiqueta="noticias válidas" detalle={`${fmt(datos.calidad.tvn)} de TVN`} />
        <Cifra valor={datos.calidad.sinFechaPublicacion} etiqueta="sin fecha de publicación" detalle="solo fecha de detección; urgencia baja" />
        <Cifra valor={datos.calidad.sinteticas} etiqueta="casos sintéticos" detalle="marcados; nunca se mezclan con reales" />
        <Cifra valor={datos.calidad.noConfiables} etiqueta="no confiables" detalle="excluidos de respuestas y paquetes" />
        <Cifra valor={datos.calidad.errores} etiqueta="errores separados" detalle="prueba T01: la carga no se bloquea" />
      </section>
    </div>
  );
}
