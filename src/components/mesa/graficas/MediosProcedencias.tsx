"use client";
import { useMemo } from "react";
import { AccionTabla, Grafica, useCompacto, type Manejadores, type Opcion } from "./Grafica";
import { AMBAR, AZUL_TVN, EJE, FUENTE, GRIS, TOOLTIP, VERDE, esc, fmt } from "./paleta";
import type { Agregados, Filtro } from "./tipos";

const TIPO: Record<string, { nombre: string; color: string }> = {
  agencia: { nombre: "Agencia (réplicas cuentan una vez)", color: AZUL_TVN },
  medio: { nombre: "Medio con redacción propia", color: "#5fa8dd" },
  primaria: { nombre: "Fuente primaria", color: VERDE },
  no_verificada: { nombre: "Independencia no verificada", color: AMBAR },
};

export function Medios({ medios, filtro, onFiltro }: { medios: Agregados["medios"]; filtro: Filtro; onFiltro: (f: Partial<Filtro>) => void }) {
  const compacto = useCompacto();
  const top = useMemo(() => medios.slice(0, 15), [medios]);
  const alternar = (m: string) => onFiltro({ medio: filtro.medio === m ? undefined : m });
  const opcion = useMemo<Opcion>(() => ({
    grid: { left: compacto ? 100 : 150, right: compacto ? 44 : 56, top: 8, bottom: 24 },
    tooltip: { ...TOOLTIP, trigger: "item", formatter: (p: { name: string; dataIndex: number }) => { const m = top[p.dataIndex]; return `<strong>${esc(p.name)}</strong><br/>${fmt(m.publicaciones)} publicaciones en ${fmt(m.eventos)} eventos${m.agencia ? "<br/>Atribuye agencia en alguna nota" : ""}`; } },
    xAxis: { type: "value", ...EJE, minInterval: 1 },
    yAxis: { type: "category", data: top.map((m) => m.medio), inverse: true, ...EJE, axisLabel: { ...EJE.axisLabel, fontSize: 11, color: "#0f1b2d", width: compacto ? 90 : 140, overflow: "truncate" }, splitLine: { show: false } },
    series: [{
      type: "bar", barWidth: 14,
      data: top.map((m) => ({ value: m.publicaciones, itemStyle: { color: filtro.medio && filtro.medio !== m.medio ? "#d9dee6" : m.medio === "TVN" ? AZUL_TVN : "#5fa8dd", borderRadius: [0, 3, 3, 0] } })),
      label: { show: true, position: "right", fontFamily: FUENTE, fontSize: 10, color: "#5b6572", formatter: (p: { value: number; dataIndex: number }) => `${fmt(p.value)}${top[p.dataIndex].agencia && !compacto ? " (agencia)" : ""}` },
      emphasis: { itemStyle: { color: AZUL_TVN } },
    }],
  }), [top, filtro.medio, compacto]);
  const manejadores = useMemo<Manejadores>(() => ({ click: (p) => { const m = (p as { name?: string }).name; if (m) alternar(m); } }), [filtro.medio, onFiltro]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabla = useMemo(() => ({
    cabeceras: ["Medio", "Publicaciones", "Eventos", "Agencia"],
    filas: top.map((m) => [m.medio, m.publicaciones, m.eventos, m.agencia ? "sí" : "no"]),
    accion: (_: unknown, i: number) => <AccionTabla pressed={filtro.medio === top[i].medio} onClick={() => alternar(top[i].medio)}>Filtrar</AccionTabla>,
    nota: `Los ${top.length} medios con más publicaciones dentro del filtro actual (tema, rango y período); el medio activo se resalta.`,
  }), [top, filtro.medio]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Grafica
      titulo="Medios con más publicaciones"
      nota="Dentro del filtro actual. Clic en un medio deja solo las publicaciones de ese medio (los demás quedan en gris para poder cambiar)."
      aria={`Barras de publicaciones por medio, ${top.length} medios`}
      opcion={opcion}
      eventos={manejadores}
      alto={Math.max(240, 40 + top.length * 24)}
      tabla={tabla}
    />
  );
}

export function Procedencias({ procedencias }: { procedencias: Agregados["procedencias"] }) {
  const compacto = useCompacto();
  const total = procedencias.reduce((s, p) => s + p.n, 0);
  const opcion = useMemo<Opcion>(() => ({
    tooltip: { ...TOOLTIP, formatter: (p: { name: string; value: number; percent: number }) => `<strong>${esc(p.name)}</strong><br/>${fmt(p.value)} (${fmt(p.percent)} %)` },
    legend: compacto
      ? { orient: "horizontal", bottom: 0, left: "center", icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 }, type: "scroll" }
      : { orient: "vertical", right: 8, top: "middle", icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { fontFamily: FUENTE, fontSize: 11 } },
    series: [{
      type: "pie", radius: compacto ? ["38%", "60%"] : ["46%", "70%"], center: compacto ? ["50%", "42%"] : ["32%", "50%"], avoidLabelOverlap: true,
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontFamily: FUENTE, fontSize: 12, formatter: "{d}%" } },
      data: procedencias.filter((p) => p.n > 0).map((p) => ({ name: TIPO[p.tipo]?.nombre ?? p.tipo, value: p.n, itemStyle: { color: TIPO[p.tipo]?.color ?? GRIS } })),
    }],
  }), [procedencias, compacto]);
  return (
    <Grafica
      titulo="Tipos de procedencia"
      nota={`${fmt(total)} procedencias en los eventos filtrados. Cinco medios que replican una agencia cuentan como una.`}
      aria="Dona con la proporción de tipos de procedencia"
      opcion={opcion}
      alto={300}
      tabla={{ cabeceras: ["Tipo", "Procedencias"], filas: procedencias.map((p) => [TIPO[p.tipo]?.nombre ?? p.tipo, p.n]), nota: "Mismo conjunto que la gráfica (filtro aplicado)." }}
      reemplazar={["series", "legend"]}
    />
  );
}
