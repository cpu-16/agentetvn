"use client";
// Envoltorio de ECharts (núcleo + módulos usados, renderer SVG): redimensiona solo, respeta reduced-motion,
// expone eventos y ofrece la tabla equivalente («Ver como tabla») con acciones para teclado y lectores de pantalla.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import { AriaComponent, BrushComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { cn } from "@/lib/utils";

echarts.use([BarChart, LineChart, PieChart, ScatterChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent, VisualMapComponent, TitleComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, SVGRenderer]);

export type Opcion = echarts.EChartsCoreOption;
export interface Tabla {
  cabeceras: string[];
  filas: (string | number | null)[][];
  /** Acción equivalente al clic en la gráfica, por fila (p. ej. «Abrir ficha», «Filtrar»). */
  accion?: (fila: (string | number | null)[], i: number) => ReactNode;
  nota?: string;
}
export type Manejadores = Record<string, (params: unknown, chart: echarts.ECharts) => void>;

interface Props {
  titulo: string;
  nota?: string;
  aria: string;
  opcion: Opcion;
  alto?: number;
  tabla?: Tabla;
  eventos?: Manejadores;
  alMontar?: (chart: echarts.ECharts) => void;
  /** Se llama UNA sola vez, tras la primera opción aplicada (p. ej. para activar el cursor de brush). */
  alPrimeraOpcion?: (chart: echarts.ECharts) => void;
  /** Componentes que se reemplazan en cada actualización (los demás se fusionan y conservan su estado: leyenda, dataZoom, brush). */
  reemplazar?: string[];
  acciones?: ReactNode;
  className?: string;
}

export const reducirMovimiento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Ancho compacto (una columna, teléfono): las gráficas ajustan leyendas y márgenes. */
export function useCompacto(): boolean {
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const f = () => setCompacto(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return compacto;
}

declare global { interface Window { __agentetvnGraficas?: Map<string, echarts.ECharts> } }

export function Grafica({ titulo, nota, aria, opcion, alto = 300, tabla, eventos, alMontar, alPrimeraOpcion, reemplazar = ["series"], acciones, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const primera = useRef(true);
  const [verTabla, setVerTabla] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
    primera.current = true;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    alMontar?.(chart);
    (window.__agentetvnGraficas ??= new Map()).set(titulo, chart); // gancho para pruebas de interfaz
    return () => { ro.disconnect(); window.__agentetvnGraficas?.delete(titulo); chart.dispose(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const sinMovimiento = reducirMovimiento();
    // Fusión: la leyenda, el dataZoom y el brush conservan su estado; las series (y lo indicado) se reemplazan.
    chart.setOption({ animation: !sinMovimiento, animationDuration: 300, animationEasing: "cubicOut", ...opcion }, { notMerge: false, replaceMerge: reemplazar as never });
    if (primera.current) { primera.current = false; alPrimeraOpcion?.(chart); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcion]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !eventos) return;
    const handlers = Object.entries(eventos).map(([nombre, fn]) => [nombre, (p: unknown) => fn(p, chart)] as const);
    for (const [nombre, h] of handlers) chart.on(nombre, h);
    return () => { for (const [nombre, h] of handlers) chart.off(nombre, h); };
  }, [eventos]);

  useEffect(() => {
    // al volver a la gráfica tras la tabla, el contenedor recupera tamaño: hay que redimensionar
    if (!verTabla) chartRef.current?.resize();
  }, [verTabla]);

  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-sm border border-border bg-white", className)} aria-labelledby={`${id}-t`}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="font-display text-[17px] font-semibold leading-tight">{titulo}</h3>
          {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {acciones}
          {tabla && (
            <button type="button" className="presionable rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground" aria-expanded={verTabla} aria-controls={`${id}-tabla`} onClick={() => setVerTabla((v) => !v)}>
              {verTabla ? "Ver gráfica" : "Ver como tabla"}
            </button>
          )}
        </div>
      </figcaption>
      <div ref={ref} role="img" aria-label={aria} aria-hidden={verTabla || undefined} style={{ height: verTabla ? 1 : alto }} className={cn("w-full px-1 pb-1", verTabla && "sr-only")} />
      <div id={`${id}-tabla`} hidden={!verTabla} className="max-h-[360px] overflow-auto px-4 pb-3">
        {tabla && verTabla && (
          <>
            {tabla.nota && <p className="mb-2 text-xs text-muted-foreground">{tabla.nota}</p>}
            <table className="w-full text-xs tabular-nums">
              <caption className="sr-only">{aria}</caption>
              <thead><tr>{tabla.cabeceras.map((c) => <th key={c} scope="col" className="border-b border-border py-1 pr-2 text-left font-medium">{c}</th>)}{tabla.accion && <th scope="col" className="border-b border-border py-1 text-left font-medium">Acción</th>}</tr></thead>
              <tbody>{tabla.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className="border-b border-border/60 py-1 pr-2">{v === null ? "sin dato" : v}</td>)}{tabla.accion && <td className="border-b border-border/60 py-1">{tabla.accion(f, i)}</td>}</tr>)}</tbody>
            </table>
          </>
        )}
      </div>
    </figure>
  );
}

/** Botón chico de acción dentro de las tablas equivalentes. */
export function AccionTabla({ children, onClick, pressed }: { children: ReactNode; onClick: () => void; pressed?: boolean }) {
  return <button type="button" aria-pressed={pressed} className={cn("presionable rounded-sm border border-border px-1.5 py-0.5 text-[11px] hover:bg-secondary", pressed && "bg-tinta text-white")} onClick={onClick}>{children}</button>;
}
