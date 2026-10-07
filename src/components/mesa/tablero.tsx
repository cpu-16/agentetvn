"use client";
// Tablero: gráficas enlazadas sobre los agregados de /api/tablero. Un filtro compartido (temas, rango, período, medio)
// se aplica a nivel de publicación con `filtrarDatos`; todas las gráficas y tarjetas leen de ese único resultado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMesa, horaPanama, fetchMesa } from "@/store/mesa";
import { cn } from "@/lib/utils";
import { SenalesPorDia } from "./graficas/SenalesPorDia";
import { MapaTemas } from "./graficas/MapaTemas";
import { RelevanciaEvidencia } from "./graficas/RelevanciaEvidencia";
import { EvidenciaPorTema } from "./graficas/EvidenciaPorTema";
import { Medios, Procedencias } from "./graficas/MediosProcedencias";
import { ContextoOficial } from "./graficas/ContextoOficial";
import { SismosMapa, SismosPorMes } from "./graficas/Sismos";
import { nombreTema, fmt } from "./graficas/paleta";
import { FILTRO_VACIO, filtrarDatos, hayFiltro, type Filtro, type Tablero as DatosTablero } from "./graficas/tipos";

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
    fetchMesa("/api/tablero").then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); setDatos(await r.json()); }).catch((e) => setError(e.message));
  }, []);

  const onFiltro = useCallback((f: Partial<Filtro>) => setFiltro((prev) => ({ ...prev, ...f })), []);
  // Jarvis filtra el tablero para demostrar cómo cambian las gráficas («filtra por economía», recorrido)
  // (estado derivado durante el render, no en un efecto; las órdenes anteriores a montar el tablero no se aplican)
  const orden = useMesa((s) => s.orden);
  const [ordenVista, setOrdenVista] = useState(() => orden?.n ?? 0);
  if (orden && orden.n !== ordenVista) { setOrdenVista(orden.n); if (orden.tipo === "filtroTablero") setFiltro(orden.limpiar ? FILTRO_VACIO : { ...FILTRO_VACIO, temas: orden.temas ?? [], medio: orden.medio }); }
  const abrirFicha = useCallback((id: string) => irA("ficha", id), [irA]);
  // UN solo conjunto filtrado para todo el tablero
  const agg = useMemo(() => (datos ? filtrarDatos(datos.eventos, filtro, nombreTema) : null), [datos, filtro]);
  // la línea de tiempo muestra todo el rango de fechas (el período se ve como área seleccionada), con tema/rango/medio aplicados
  const aggSinPeriodo = useMemo(() => (datos ? filtrarDatos(datos.eventos, { ...filtro, desde: undefined, hasta: undefined }, nombreTema) : null), [datos, filtro]);
  const aggSinTema = useMemo(() => (datos ? filtrarDatos(datos.eventos, { ...filtro, temas: [], desde: undefined, hasta: undefined }, nombreTema) : null), [datos, filtro]);

  const descripcionFiltro = [filtro.temas.map(nombreTema).join(", "), filtro.rango.length ? `rango ${filtro.rango.join("/")}` : "", filtro.desde || filtro.hasta ? `${dia(filtro.desde)} a ${dia(filtro.hasta)}` : "", filtro.medio ?? ""].filter(Boolean).join("; ");
  // Jarvis: el filtro que ve la persona («explícame esta pantalla»)
  const setPantalla = useMesa((s) => s.setPantalla);
  useEffect(() => setPantalla({ filtroTablero: descripcionFiltro }), [descripcionFiltro, setPantalla]);

  if (error) return <div className="rounded-sm border border-senal/40 bg-white p-6 text-sm" role="alert">No se pudo cargar el tablero. Avisa al equipo técnico. <span className="text-muted-foreground">(código {error})</span></div>;
  if (!datos || !agg || !aggSinPeriodo || !aggSinTema) return <div className="p-6 text-sm text-muted-foreground" aria-busy="true">Cargando el tablero…</div>;

  const suficientes = agg.eventos.filter((e) => e.estado_evidencia === "suficiente").length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none">Tablero de señales</h1>
          <p className="mt-1 text-sm text-muted-foreground">De dónde vienen las señales, cómo se reparten por tema y evidencia, y qué dicen los datos oficiales. Corte {horaPanama(datos.corteUTC)}.</p>
        </div>
        <button type="button" className="presionable rounded-sm bg-tinta px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!hayFiltro(filtro) || !agg.eventos.length} onClick={() => { setFiltroTablero({ ids: agg.eventos.map((e) => e.id), descripcion: descripcionFiltro }); irA("agenda"); }}>
          Ver estos {fmt(agg.eventos.length)} temas en la agenda
        </button>
      </header>

      <section data-guia="tablero-filtros" aria-label="Filtros activos" className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-white px-3 py-2 text-sm">
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

      <section data-guia="tablero-cifras" className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Cifras del corte">
        <Cifra valor={agg.publicaciones} etiqueta="publicaciones" detalle={hayFiltro(filtro) ? `de ${fmt(datos.publicaciones)}` : "en el corte"} />
        <Cifra valor={agg.eventos.length} etiqueta="eventos agrupados" detalle={hayFiltro(filtro) ? `de ${fmt(datos.eventos.length)}` : "un hecho, varias publicaciones"} />
        <Cifra valor={agg.mediosDistintos} etiqueta="medios distintos" detalle={`${fmt(agg.agenciasDistintas)} agencia${agg.agenciasDistintas === 1 ? "" : "s"} identificada${agg.agenciasDistintas === 1 ? "" : "s"} en los textos${hayFiltro(filtro) ? ", en lo filtrado" : ""}`} />
        <Cifra valor={suficientes} etiqueta="con evidencia suficiente" detalle={`${agg.eventos.length ? Math.round((suficientes / agg.eventos.length) * 100) : 0} % de los eventos`} />
      </section>

      <p className="text-xs text-muted-foreground">
        Fuera del tablero: {fmt(datos.calidad.sinteticas)} publicaciones de casos de prueba sintéticos{datos.calidad.noConfiablesReales ? ` y ${fmt(datos.calidad.noConfiablesReales)} reales marcadas como no confiables` : ""}. En la agenda aparecen marcadas.
      </p>

      <div data-guia="tablero-dias"><SenalesPorDia datos={aggSinTema.porDiaTema} filtro={filtro} onFiltro={onFiltro} porDeteccion={aggSinTema.porDeteccion} total={aggSinTema.publicaciones} /></div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div data-guia="tablero-temas" className="min-w-0"><MapaTemas temas={agg.temas} eventos={agg.eventos} filtro={filtro} onFiltro={onFiltro} abrirFicha={abrirFicha} /></div>
        <div data-guia="tablero-relevancia" className="min-w-0"><RelevanciaEvidencia eventos={agg.eventos} abrirFicha={abrirFicha} /></div>
        <div data-guia="tablero-evidencia" className="min-w-0"><EvidenciaPorTema evidencia={agg.evidencia} /></div>
        <div data-guia="tablero-medios" className="min-w-0"><Medios medios={agg.medios} filtro={filtro} onFiltro={onFiltro} /></div>
        <div data-guia="tablero-procedencias" className="min-w-0"><Procedencias procedencias={agg.procedencias} /></div>
        <div data-guia="tablero-contexto" className="min-w-0"><ContextoOficial indicadores={datos.indicadores} /></div>
        <div data-guia="tablero-sismos" className="min-w-0"><SismosMapa sismos={datos.sismos} /></div>
        <div data-guia="tablero-sismos-mes" className="min-w-0"><SismosPorMes meses={datos.sismosPorMes} /></div>
      </div>

      <section aria-label="Calidad del corte" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Cifra valor={datos.calidad.tablero} etiqueta="noticias reales en el tablero" detalle={`${fmt(datos.calidad.tvn)} de TVN; ${fmt(datos.calidad.noticias)} válidas en el corte`} />
        <Cifra valor={datos.calidad.sinFechaPublicacion} etiqueta="sin fecha de publicación" detalle="ubicadas por fecha de detección; urgencia baja" />
        <Cifra valor={datos.calidad.sinteticas} etiqueta="casos sintéticos" detalle="fuera del tablero; en la agenda, marcados" />
        <Cifra valor={datos.calidad.noConfiables} etiqueta="no confiables" detalle="fuera del tablero, de respuestas y de paquetes" />
        <Cifra valor={datos.calidad.errores} etiqueta="errores separados" detalle="prueba T01: la carga no se bloquea" />
      </section>
    </div>
  );
}
