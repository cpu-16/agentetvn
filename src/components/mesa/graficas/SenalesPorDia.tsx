"use client";
import { useEffect, useMemo, useRef } from "react";
import type { ECharts } from "echarts/core";
import { Grafica, useCompacto, type Manejadores, type Opcion } from "./Grafica";
import { colorTema, EJE, FUENTE, leyenda, nombreTema, ORDEN_TEMAS, TOOLTIP, esc, fmt } from "./paleta";
import type { Filtro, Tablero } from "./tipos";

interface Props { datos: Tablero["porDiaTema"]; filtro: Filtro; onFiltro: (f: Partial<Filtro>) => void }

const diaCorto = (d: string) => new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export function SenalesPorDia({ datos, filtro, onFiltro }: Props) {
  const compacto = useCompacto();
  const chartRef = useRef<ECharts | null>(null);
  const diasRef = useRef<string[]>([]);
  // Siempre las 8 series (las presentes en el corte): la leyenda es un interruptor real y el tema apagado se guarda en el filtro.
  const { dias, temas, matriz } = useMemo(() => {
    const dias = [...new Set(datos.map((d) => d.dia))].sort();
    const presentes = new Set(datos.map((d) => d.tema));
    const temas = ORDEN_TEMAS.filter((t) => presentes.has(t));
    const idx = new Map(dias.map((d, i) => [d, i]));
    const matriz = Object.fromEntries(temas.map((t) => [t, new Array<number>(dias.length).fill(0)]));
    for (const d of datos) if (matriz[d.tema]) matriz[d.tema][idx.get(d.dia)!] += d.n;
    return { dias, temas, matriz };
  }, [datos]);
  useEffect(() => { diasRef.current = dias; }, [dias]);
  const seleccion = useMemo(() => Object.fromEntries(temas.map((t) => [nombreTema(t), !filtro.temas.length || filtro.temas.includes(t)])), [temas, filtro.temas]);

  const opcion = useMemo<Opcion>(() => ({
    color: temas.map(colorTema),
    grid: { left: 44, right: 16, top: compacto ? 44 : 40, bottom: 64 },
    tooltip: {
      ...TOOLTIP, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: "#9aa4b2" } },
      // formatter propio: el de eje por defecto inserta seriesName como HTML sin escapar
      formatter: (ps: { axisValue: string; seriesName: string; value: number; marker: string }[]) => {
        const filas = ps.filter((p) => p.value > 0).map((p) => `${p.marker} ${esc(p.seriesName)}: ${fmt(p.value)}`);
        return `<strong>${esc(diaCorto(ps[0].axisValue))}</strong><br/>${filas.length ? filas.join("<br/>") : "sin publicaciones"}`;
      },
    },
    legend: { ...leyenda(compacto), data: temas.map(nombreTema), selected: seleccion },
    xAxis: { type: "category", data: dias, boundaryGap: false, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: diaCorto, hideOverlap: true } },
    yAxis: { type: "value", ...EJE, minInterval: 1 },
    dataZoom: [{ type: "slider", xAxisIndex: 0, height: 18, bottom: 10, borderColor: "#d9dee6", fillerColor: "rgba(0,119,200,.12)", handleStyle: { color: "#0077c8" }, textStyle: { fontFamily: FUENTE, fontSize: 10 }, labelFormatter: (_: number, v: string) => (v ? diaCorto(v) : "") }],
    brush: { xAxisIndex: 0, brushType: "lineX", brushMode: "single", brushStyle: { color: "rgba(0,119,200,.10)", borderColor: "#0077c8" }, throttleType: "debounce", throttleDelay: 200, removeOnClick: false },
    series: temas.map((t) => ({ name: nombreTema(t), type: "line", stack: "total", areaStyle: { opacity: 0.85 }, lineStyle: { width: 1, color: "#fff" }, showSymbol: false, emphasis: { focus: "series" }, data: matriz[t] })),
  }), [dias, temas, matriz, seleccion, compacto]);

  const eventos = useMemo<Manejadores>(() => ({
    brushEnd: (p) => {
      const areas = (p as { areas?: { coordRange?: [number, number] }[] }).areas ?? [];
      const r = areas[0]?.coordRange;
      if (!r) return; // sin área (p. ej. al limpiar desde fuera) no se toca el período
      const d = diasRef.current;
      const a = Math.max(0, Math.round(r[0])), b = Math.min(d.length - 1, Math.round(r[1]));
      if (a > b) return;
      onFiltro({ desde: d[a], hasta: d[b] });
    },
    legendselectchanged: (p) => {
      const sel = (p as { selected: Record<string, boolean> }).selected;
      const activos = temas.filter((t) => sel[nombreTema(t)] !== false);
      onFiltro({ temas: activos.length === temas.length ? [] : activos });
    },
  }), [temas, onFiltro]);

  // cuando el período se quita desde fuera (chip, «Limpiar»), se borra el área del brush
  useEffect(() => {
    if (!filtro.desde && !filtro.hasta) chartRef.current?.dispatchAction({ type: "brush", areas: [] });
  }, [filtro.desde, filtro.hasta]);

  const tabla = useMemo(() => ({ cabeceras: ["Día", ...temas.map(nombreTema)], filas: dias.map((d, i) => [d, ...temas.map((t) => matriz[t][i])]) }), [dias, temas, matriz]);

  return (
    <Grafica
      titulo="Señales por día y tema"
      nota="Publicaciones por día en hora de Panamá, de todo el rango de fechas. Arrastra sobre el área para fijar el período del tablero; la leyenda enciende y apaga temas."
      aria={`Área apilada de publicaciones por día y tema, ${dias.length} días y ${temas.length} temas`}
      opcion={opcion}
      eventos={eventos}
      alto={320}
      tabla={tabla}
      alMontar={(c) => { chartRef.current = c; }}
      alPrimeraOpcion={(c) => c.dispatchAction({ type: "takeGlobalCursor", key: "brush", brushOption: { brushType: "lineX", brushMode: "single" } })}
      reemplazar={["series"]}
    />
  );
}
