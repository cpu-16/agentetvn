"use client";
import { useMemo } from "react";
import { Grafica, type Manejadores, type Opcion } from "./Grafica";
import { COLOR_RANGO, EJE, FUENTE, TOOLTIP, esc, fmt } from "./paleta";
import type { EventoTablero } from "./tipos";

interface Props { eventos: EventoTablero[]; abrirFicha: (id: string) => void }
const GRUPOS = [
  { id: "investigar", nombre: "Alto con evidencia insuficiente: investigar" },
  { id: "alto", nombre: "Alto" },
  { id: "medio", nombre: "Medio" },
  { id: "bajo", nombre: "Bajo" },
] as const;
const grupoDe = (e: EventoTablero) => (e.rango === "alto" && e.estado_evidencia === "insuficiente" ? "investigar" : e.rango);

export function RelevanciaEvidencia({ eventos, abrirFicha }: Props) {
  const series = useMemo(() => GRUPOS.map((g) => ({
    name: g.nombre, type: "scatter",
    data: eventos.filter((e) => grupoDe(e) === g.id).map((e) => ({ value: [e.R, e.E, e.publicaciones], id: e.id, titulo: e.titulo, P: e.P, estado: e.estado_evidencia })),
    symbolSize: (v: number[]) => Math.max(8, Math.min(30, 6 + Math.sqrt(v[2]) * 5)),
    itemStyle: { color: COLOR_RANGO[g.id], opacity: 0.82, borderColor: "#fff", borderWidth: 1.5 },
    emphasis: { focus: "self", scale: 1.15 },
  })), [eventos]);

  const opcion = useMemo<Opcion>(() => ({
    grid: { left: 44, right: 16, top: 56, bottom: 40 },
    legend: { top: 0, left: 0, icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 } },
    tooltip: { ...TOOLTIP, formatter: (p: { data: { titulo: string; P: number; estado: string; value: number[] } }) => `<strong>${esc(p.data.titulo)}</strong><br/>P ${fmt(p.data.P, 1)}; evidencia ${esc(p.data.estado)}<br/>Relevancia ${p.data.value[0]}, evidencia ${p.data.value[1]}, ${fmt(p.data.value[2])} publicaciones` },
    xAxis: { type: "value", min: 0, max: 1, name: "relevancia (R)", nameLocation: "middle", nameGap: 24, nameTextStyle: { color: "#5b6572", fontFamily: FUENTE, fontSize: 11 }, ...EJE },
    yAxis: { type: "value", min: 0, max: 1, name: "evidencia (E)", nameTextStyle: { color: "#5b6572", fontFamily: FUENTE, fontSize: 11, align: "left" }, ...EJE },
    series: series.map((s, i) => (i === 0 ? { ...s, markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#9aa4b2" }, label: { fontFamily: FUENTE, fontSize: 10, color: "#5b6572" }, data: [{ xAxis: 0.5, label: { formatter: "relevancia 0.5", position: "insideStartTop" } }, { yAxis: 0.4, label: { formatter: "evidencia 0.4: por debajo, investigar", position: "insideEndBottom" } }] } } : s)),
  }), [series]);

  const manejadores = useMemo<Manejadores>(() => ({ click: (p) => { const id = (p as { data?: { id?: string } }).data?.id; if (id) abrirFicha(id); } }), [abrirFicha]);
  const tabla = useMemo(() => ({ cabeceras: ["Titular", "R", "E", "Publicaciones", "P", "Evidencia"], filas: eventos.map((e) => [e.titulo, e.R, e.E, e.publicaciones, e.P, e.estado_evidencia]) }), [eventos]);

  return (
    <Grafica
      titulo="Relevancia frente a evidencia"
      nota="Cada punto es un evento; el tamaño, sus publicaciones. Arriba a la derecha: relevante y respaldado. Rojo: prioridad alta sin evidencia suficiente. Clic abre la ficha."
      aria={`Dispersión de ${eventos.length} eventos por relevancia y evidencia`}
      opcion={opcion}
      eventos={manejadores}
      alto={360}
      tabla={tabla}
    />
  );
}
