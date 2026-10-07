"use client";
import { useMemo } from "react";
import { Grafica, useCompacto, type Opcion } from "./Grafica";
import { COLOR_EVIDENCIA, EJE, FUENTE, leyenda, nombreTema, ORDEN_TEMAS, TOOLTIP, esc, fmt } from "./paleta";
import type { Agregados } from "./tipos";

const ESTADOS = [["insuficiente", "Insuficiente"], ["parcial", "Parcial"], ["suficiente", "Suficiente para el borrador"]] as const;

/** Porcentajes a un decimal que cierran exactamente en 100 (el último tramo absorbe el redondeo). */
export function porcentajes(partes: number[]): number[] {
  const total = partes.reduce((s, x) => s + x, 0);
  if (!total) return partes.map(() => 0);
  const out = partes.map((x) => Math.round((x / total) * 1000) / 10);
  const ultimo = out.length - 1;
  out[ultimo] = Math.round((100 - out.slice(0, ultimo).reduce((s, x) => s + x, 0)) * 10) / 10;
  return out;
}

export function EvidenciaPorTema({ evidencia }: { evidencia: Agregados["evidencia"] }) {
  const compacto = useCompacto();
  const filas = useMemo(() => ORDEN_TEMAS.map((t) => evidencia.find((e) => e.tema === t)).filter((f): f is Agregados["evidencia"][number] => !!f).map((f) => {
    const n = [f.insuficiente, f.parcial, f.suficiente];
    const pct = porcentajes(n);
    return { tema: f.tema, total: n[0] + n[1] + n[2], n, pct };
  }).filter((f) => f.total > 0), [evidencia]);

  const opcion = useMemo<Opcion>(() => ({
    grid: { left: compacto ? 96 : 130, right: 24, top: 32, bottom: 24 },
    legend: leyenda(compacto),
    tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { seriesName: string; dataIndex: number; data: { value: number; n: number } }[]) => { const f = filas[ps[0].dataIndex]; return `<strong>${esc(nombreTema(f.tema))}</strong>, ${fmt(f.total)} eventos<br/>${ps.map((p) => `${esc(p.seriesName)}: ${fmt(p.data.n)} (${fmt(p.data.value, 1)} %)`).join("<br/>")}`; } },
    xAxis: { type: "value", max: 100, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: "{value} %" } },
    yAxis: { type: "category", data: filas.map((f) => nombreTema(f.tema)), inverse: true, ...EJE, axisLabel: { ...EJE.axisLabel, fontSize: compacto ? 11 : 12, color: "#0f1b2d", width: compacto ? 86 : 120, overflow: "truncate" }, splitLine: { show: false } },
    series: ESTADOS.map(([id, nombre], k) => ({
      name: nombre, type: "bar", stack: "total", barWidth: 16,
      itemStyle: { color: COLOR_EVIDENCIA[id], borderColor: "#fff", borderWidth: 1 },
      label: { show: true, position: "inside", fontFamily: FUENTE, fontSize: 10, color: "#fff", formatter: (p: { value: number }) => (p.value >= 12 ? `${Math.round(p.value)} %` : "") },
      data: filas.map((f) => ({ value: f.pct[k], n: f.n[k] })),
    })),
  }), [filas, compacto]);

  const tabla = useMemo(() => ({ cabeceras: ["Tema", "Eventos", "Insuficiente", "Parcial", "Suficiente"], filas: filas.map((f) => [nombreTema(f.tema), f.total, f.n[0], f.n[1], f.n[2]]), nota: "Conteos enteros del mismo conjunto que la gráfica. El estado es del evento completo, aunque se filtre por un medio." }), [filas]);

  return (
    <Grafica
      titulo="Estado de evidencia por tema"
      nota="Porcentaje dentro de cada tema, sobre los eventos del filtro (sin casos de prueba). Insuficiente casi siempre es una sola fuente sin fuente primaria: una pista para reportear, no una noticia descartada."
      aria={`Barras apiladas del estado de evidencia en ${filas.length} temas`}
      opcion={opcion}
      alto={Math.max(220, 40 + filas.length * 34)}
      tabla={tabla}
    />
  );
}
