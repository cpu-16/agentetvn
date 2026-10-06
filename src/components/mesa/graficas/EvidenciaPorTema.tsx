"use client";
import { useMemo } from "react";
import { Grafica, type Opcion } from "./Grafica";
import { COLOR_EVIDENCIA, EJE, FUENTE, nombreTema, ORDEN_TEMAS, TOOLTIP, esc, fmt } from "./paleta";
import type { EventoTablero } from "./tipos";

const ESTADOS = [["insuficiente", "Insuficiente"], ["parcial", "Parcial"], ["suficiente", "Suficiente para el borrador"]] as const;

export function EvidenciaPorTema({ eventos }: { eventos: EventoTablero[] }) {
  const filas = useMemo(() => ORDEN_TEMAS.map((t) => {
    const evs = eventos.filter((e) => e.tema === t);
    const total = evs.length;
    return { tema: t, total, ...Object.fromEntries(ESTADOS.map(([id]) => [id, evs.filter((e) => e.estado_evidencia === id).length])) } as { tema: string; total: number } & Record<string, number>;
  }).filter((f) => f.total > 0), [eventos]);

  const opcion = useMemo<Opcion>(() => ({
    grid: { left: 130, right: 24, top: 32, bottom: 24 },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 } },
    tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { seriesName: string; value: number; dataIndex: number }[]) => { const f = filas[ps[0].dataIndex]; return `<strong>${esc(nombreTema(f.tema))}</strong>, ${fmt(f.total)} eventos<br/>${ps.map((p) => `${esc(p.seriesName)}: ${fmt((p.value / 100) * f.total)} (${fmt(p.value)} %)`).join("<br/>")}`; } },
    xAxis: { type: "value", max: 100, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: "{value} %" } },
    yAxis: { type: "category", data: filas.map((f) => nombreTema(f.tema)), inverse: true, ...EJE, axisLabel: { ...EJE.axisLabel, fontSize: 12, color: "#0f1b2d" }, splitLine: { show: false } },
    series: ESTADOS.map(([id, nombre]) => ({
      name: nombre, type: "bar", stack: "total", barWidth: 16,
      itemStyle: { color: COLOR_EVIDENCIA[id], borderColor: "#fff", borderWidth: 1 },
      label: { show: true, position: "inside", fontFamily: FUENTE, fontSize: 10, color: "#fff", formatter: (p: { value: number }) => (p.value >= 12 ? `${Math.round(p.value)} %` : "") },
      data: filas.map((f) => Math.round((f[id] / f.total) * 1000) / 10),
    })),
  }), [filas]);

  const tabla = useMemo(() => ({ cabeceras: ["Tema", "Eventos", "Insuficiente", "Parcial", "Suficiente"], filas: filas.map((f) => [nombreTema(f.tema), f.total, f.insuficiente, f.parcial, f.suficiente]) }), [filas]);

  return (
    <Grafica
      titulo="Estado de evidencia por tema"
      nota="Porcentaje de eventos por estado. El puntaje ordena; la evidencia decide si se puede escribir."
      aria={`Barras apiladas del estado de evidencia en ${filas.length} temas`}
      opcion={opcion}
      alto={Math.max(220, 40 + filas.length * 34)}
      tabla={tabla}
    />
  );
}
