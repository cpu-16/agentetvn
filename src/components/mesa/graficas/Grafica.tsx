"use client";
// Envoltorio de ECharts (núcleo + módulos usados, renderer SVG): redimensiona solo, respeta reduced-motion,
// expone eventos y ofrece la tabla equivalente («Ver como tabla») para lectores de pantalla.
import { useEffect, useId, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import { AriaComponent, BrushComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { cn } from "@/lib/utils";

echarts.use([BarChart, LineChart, PieChart, ScatterChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, BrushComponent, VisualMapComponent, TitleComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, SVGRenderer]);

export type Opcion = echarts.EChartsCoreOption;
export interface Tabla { cabeceras: string[]; filas: (string | number | null)[][] }
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
  /** Se llama después de cada setOption (p. ej. para activar el cursor de brush, que exige que el componente ya exista). */
  trasOpcion?: (chart: echarts.ECharts) => void;
  acciones?: React.ReactNode;
  className?: string;
}

export const reducirMovimiento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

declare global { interface Window { __agentetvnGraficas?: Map<string, echarts.ECharts> } }

export function Grafica({ titulo, nota, aria, opcion, alto = 300, tabla, eventos, alMontar, trasOpcion, acciones, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [verTabla, setVerTabla] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
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
    chart.setOption({ animation: !sinMovimiento, animationDuration: 300, animationEasing: "cubicOut", ...opcion }, { notMerge: true });
    trasOpcion?.(chart);
  }, [opcion, trasOpcion]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !eventos) return;
    for (const [nombre, fn] of Object.entries(eventos)) chart.on(nombre, (p: unknown) => fn(p, chart));
    return () => { for (const nombre of Object.keys(eventos)) chart.off(nombre); };
  }, [eventos]);

  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-sm border border-border bg-white", className)} aria-labelledby={`${id}-t`}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3">
        <div>
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
      <div ref={ref} role="img" aria-label={aria} style={{ height: alto }} className={cn("w-full px-1 pb-1", verTabla && "sr-only")} />
      {tabla && verTabla && (
        <div id={`${id}-tabla`} className="max-h-[320px] overflow-auto px-4 pb-3">
          <table className="w-full text-xs tabular-nums">
            <thead><tr>{tabla.cabeceras.map((c) => <th key={c} scope="col" className="border-b border-border py-1 pr-2 text-left font-medium">{c}</th>)}</tr></thead>
            <tbody>{tabla.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className="border-b border-border/60 py-1 pr-2">{v === null ? "sin dato" : v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
