"use client";
import { useMemo, useState } from "react";
import { Grafica, useCompacto, type Opcion } from "./Grafica";
import { AZUL_TVN, EJE, FUENTE, TOOLTIP, fmt } from "./paleta";
import type { Tablero } from "./tipos";

const PAIS: Record<string, string> = { PAN: "Panamá", CRI: "Costa Rica", COL: "Colombia", DOM: "Rep. Dominicana", MEX: "México", GTM: "Guatemala" };

export function ContextoOficial({ indicadores }: { indicadores: Tablero["indicadores"] }) {
  const compacto = useCompacto();
  const [sel, setSel] = useState(indicadores[0]?.indicador_id ?? "");
  const ind = indicadores.find((i) => i.indicador_id === sel) ?? indicadores[0];
  const unidad = ind?.unidad ?? "";
  const decimales = unidad === "personas" ? 0 : 1;

  const opcion = useMemo<Opcion>(() => {
    if (!ind) return {};
    const anios = ind.series[0]?.puntos.map((p) => p[0]) ?? [];
    const ordenadas = [...ind.series].sort((a) => (a.pais === "PAN" ? 1 : -1)); // Panamá al final = encima
    return {
      grid: { left: compacto ? 48 : 64, right: compacto ? 56 : 64, top: compacto ? 44 : 40, bottom: 28 },
      legend: { top: 0, left: 0, type: compacto ? "scroll" : "plain", icon: "roundRect", itemWidth: 14, itemHeight: 3, textStyle: { fontFamily: FUENTE, fontSize: 11 }, data: ind.series.map((s) => PAIS[s.pais] ?? s.pais) },
      tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: "#9aa4b2" } }, valueFormatter: (v: number | null) => (v === null || v === undefined ? "sin dato" : `${fmt(v, decimales)} ${unidad}`) },
      xAxis: { type: "category", data: anios, boundaryGap: false, ...EJE },
      yAxis: { type: "value", ...EJE, axisLabel: { ...EJE.axisLabel, formatter: (v: number) => (unidad === "personas" ? `${fmt(v / 1e6, 0)} M` : fmt(v, 0)) }, scale: true },
      series: ordenadas.map((s) => ({
        name: PAIS[s.pais] ?? s.pais, type: "line", connectNulls: false, showSymbol: false, symbol: "circle", symbolSize: 8,
        lineStyle: { width: s.pais === "PAN" ? 3 : 1.5, color: s.pais === "PAN" ? AZUL_TVN : "#aab3bf" },
        itemStyle: { color: s.pais === "PAN" ? AZUL_TVN : "#aab3bf" },
        emphasis: { focus: "series", lineStyle: { width: 3 } },
        endLabel: s.pais === "PAN" ? { show: true, formatter: "Panamá", fontFamily: FUENTE, fontSize: 11, color: AZUL_TVN } : undefined,
        data: s.puntos.map((p) => p[1]),
      })),
    };
  }, [ind, unidad, decimales, compacto]);

  const tabla = useMemo(() => ind ? { cabeceras: ["Año", ...ind.series.map((s) => PAIS[s.pais] ?? s.pais)], filas: (ind.series[0]?.puntos ?? []).map((p, i) => [p[0], ...ind.series.map((s) => (s.puntos[i][1] === null ? null : fmt(s.puntos[i][1] as number, decimales)))]) } : undefined, [ind, decimales]);

  return (
    <Grafica
      titulo="Contexto oficial: Banco Mundial"
      nota={`${ind?.nombre ?? ""}, en ${unidad}. Dato anual, contexto histórico: no es una medición de hoy. Los huecos son valores no publicados; nunca se rellenan con cero.`}
      aria={`Líneas de ${ind?.nombre ?? "indicador"} 2010 a 2024 para seis países, Panamá resaltado`}
      opcion={opcion}
      alto={320}
      tabla={tabla}
      acciones={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Indicador</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-8 max-w-[220px] rounded-sm border border-border bg-white px-2 text-xs text-foreground">
            {indicadores.map((i) => <option key={i.indicador_id} value={i.indicador_id}>{i.nombre}</option>)}
          </select>
        </label>
      }
    />
  );
}
