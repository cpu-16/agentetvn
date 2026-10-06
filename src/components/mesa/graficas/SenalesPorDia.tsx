"use client";
import { useMemo } from "react";
import { Grafica, type Manejadores, type Opcion } from "./Grafica";
import { colorTema, EJE, FUENTE, nombreTema, ORDEN_TEMAS, TOOLTIP, fmt } from "./paleta";
import type { Filtro, Tablero } from "./tipos";

interface Props { datos: Tablero["porDiaTema"]; filtro: Filtro; onFiltro: (f: Partial<Filtro>) => void }

const diaCorto = (d: string) => new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

const activarBrush = (chart: { dispatchAction: (a: unknown) => void }) => chart.dispatchAction({ type: "takeGlobalCursor", key: "brush", brushOption: { brushType: "lineX", brushMode: "single" } });

export function SenalesPorDia({ datos, filtro, onFiltro }: Props) {
  const { dias, temas, matriz } = useMemo(() => {
    const dias = [...new Set(datos.map((d) => d.dia))].sort();
    const presentes = new Set(datos.map((d) => d.tema));
    const temas = ORDEN_TEMAS.filter((t) => presentes.has(t)).filter((t) => !filtro.temas.length || filtro.temas.includes(t));
    const idx = new Map(dias.map((d, i) => [d, i]));
    const matriz = Object.fromEntries(temas.map((t) => [t, new Array<number>(dias.length).fill(0)]));
    for (const d of datos) if (matriz[d.tema]) matriz[d.tema][idx.get(d.dia)!] += d.n;
    return { dias, temas, matriz };
  }, [datos, filtro.temas]);

  const opcion = useMemo<Opcion>(() => ({
    color: temas.map(colorTema),
    grid: { left: 44, right: 16, top: 40, bottom: 64 },
    tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: "#9aa4b2" } }, valueFormatter: (v: number) => fmt(v) },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 }, data: temas.map(nombreTema) },
    xAxis: { type: "category", data: dias, boundaryGap: false, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: diaCorto, hideOverlap: true } },
    yAxis: { type: "value", ...EJE, minInterval: 1 },
    dataZoom: [{ type: "slider", xAxisIndex: 0, height: 18, bottom: 10, borderColor: "#d9dee6", fillerColor: "rgba(0,119,200,.12)", handleStyle: { color: "#0077c8" }, textStyle: { fontFamily: FUENTE, fontSize: 10 }, labelFormatter: (_: number, v: string) => (v ? diaCorto(v) : "") }],
    brush: { xAxisIndex: 0, brushType: "lineX", brushMode: "single", brushStyle: { color: "rgba(0,119,200,.10)", borderColor: "#0077c8" }, throttleType: "debounce", throttleDelay: 200, removeOnClick: true },
    series: temas.map((t) => ({ name: nombreTema(t), type: "line", stack: "total", areaStyle: { opacity: 0.85 }, lineStyle: { width: 1, color: "#fff" }, showSymbol: false, emphasis: { focus: "series" }, data: matriz[t] })),
  }), [dias, temas, matriz]);

  const eventos = useMemo<Manejadores>(() => ({
    brushEnd: (p) => {
      const areas = (p as { areas?: { coordRange?: [number, number] }[] }).areas ?? [];
      const r = areas[0]?.coordRange;
      if (!r) { onFiltro({ desde: undefined, hasta: undefined }); return; }
      const a = Math.max(0, Math.round(r[0])), b = Math.min(dias.length - 1, Math.round(r[1]));
      onFiltro({ desde: dias[a], hasta: dias[b] });
    },
    legendselectchanged: (p) => {
      const sel = (p as { selected: Record<string, boolean> }).selected;
      const activos = temas.filter((t) => sel[nombreTema(t)] !== false);
      onFiltro({ temas: activos.length === temas.length ? [] : activos });
    },
  }), [dias, temas, onFiltro]);

  const tabla = useMemo(() => ({ cabeceras: ["Día", ...temas.map(nombreTema)], filas: dias.map((d, i) => [d, ...temas.map((t) => matriz[t][i])]) }), [dias, temas, matriz]);

  return (
    <Grafica
      titulo="Señales por día y tema"
      nota="Publicaciones por día en hora de Panamá. Arrastra sobre el área para acotar el período en todo el tablero; la leyenda enciende y apaga temas."
      aria={`Área apilada de publicaciones por día y tema, ${dias.length} días y ${temas.length} temas`}
      opcion={opcion}
      eventos={eventos}
      alto={320}
      tabla={tabla}
      trasOpcion={activarBrush}
    />
  );
}
