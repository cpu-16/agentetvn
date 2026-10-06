"use client";
import { useMemo } from "react";
import { Grafica, type Opcion } from "./Grafica";
import { AZUL_TVN, EJE, FUENTE, RAMPA_AZUL, TOOLTIP, esc, fmt } from "./paleta";
import type { Tablero } from "./tipos";

const fechaPA = (iso: string) => new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const urlSegura = (u: string) => { try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? p.href : null; } catch { return null; } };

export function SismosMapa({ sismos }: { sismos: Tablero["sismos"] }) {
  const opcion = useMemo<Opcion>(() => ({
    grid: { left: 48, right: 16, top: 16, bottom: 56 },
    tooltip: { ...TOOLTIP, formatter: (p: { data: { s: Tablero["sismos"][number] } }) => `<strong>M ${fmt(p.data.s.mag, 1)}</strong>, ${esc(p.data.s.place)}<br/>${esc(fechaPA(p.data.s.time))}, profundidad ${fmt(p.data.s.depth)} km` },
    visualMap: { type: "continuous", dimension: 3, min: 0, max: Math.max(50, ...sismos.map((s) => s.depth)), inRange: { color: RAMPA_AZUL }, text: ["profundo", "superficial"], orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, itemWidth: 10, textStyle: { fontFamily: FUENTE, fontSize: 10, color: "#5b6572" }, calculable: false },
    xAxis: { type: "value", min: -86, max: -76, name: "longitud", nameLocation: "middle", nameGap: 22, nameTextStyle: { color: "#5b6572", fontFamily: FUENTE, fontSize: 11 }, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: (v: number) => `${v}°` } },
    yAxis: { type: "value", min: 5, max: 12, name: "latitud", nameTextStyle: { color: "#5b6572", fontFamily: FUENTE, fontSize: 11, align: "left" }, ...EJE, axisLabel: { ...EJE.axisLabel, formatter: (v: number) => `${v}°` } },
    series: [{
      type: "scatter",
      data: sismos.map((s) => ({ value: [s.lon, s.lat, s.mag, s.depth], s })),
      symbolSize: (v: number[]) => Math.max(6, (v[2] - 2.5) * 9),
      itemStyle: { opacity: 0.8, borderColor: "#fff", borderWidth: 1 },
      emphasis: { itemStyle: { borderColor: AZUL_TVN, borderWidth: 2 } },
      markArea: { silent: true, itemStyle: { color: "transparent", borderColor: "#9aa4b2", borderType: "dashed", borderWidth: 1 }, label: { show: true, position: "insideTopLeft", fontFamily: FUENTE, fontSize: 10, color: "#5b6572", formatter: "Caja de consulta USGS: no equivale al territorio de Panamá" }, data: [[{ coord: [-86, 12] }, { coord: [-76, 5] }]] },
    }],
  }), [sismos]);
  return (
    <Grafica
      titulo="Sismos USGS 2024 en la región"
      nota="Tamaño: magnitud (todos M ≥ 3). Color: profundidad. Solo hechos sísmicos; nunca evidencia de daños ni pérdidas."
      aria={`Dispersión geográfica de ${sismos.length} sismos de 2024 en la caja latitud 5 a 12, longitud menos 86 a menos 76`}
      opcion={opcion}
      alto={380}
      tabla={{ cabeceras: ["Fecha (Panamá)", "Magnitud", "Lugar", "Profundidad (km)", "Evento USGS"], filas: [...sismos].sort((a, b) => b.mag - a.mag).map((s) => [fechaPA(s.time), fmt(s.mag, 1), s.place, fmt(s.depth), urlSegura(s.url) ?? s.id]) }}
    />
  );
}

export function SismosPorMes({ meses }: { meses: Tablero["sismosPorMes"] }) {
  const etiqueta = (m: string) => new Intl.DateTimeFormat("es-PA", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
  const opcion = useMemo<Opcion>(() => ({
    grid: { left: 36, right: 16, top: 16, bottom: 28 },
    tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { dataIndex: number }[]) => { const m = meses[ps[0].dataIndex]; return `<strong>${etiqueta(m.mes)} 2024</strong><br/>${fmt(m.n)} sismos, magnitud máxima ${fmt(m.magMax, 1)}`; } },
    xAxis: { type: "category", data: meses.map((m) => etiqueta(m.mes)), ...EJE },
    yAxis: { type: "value", minInterval: 1, ...EJE },
    series: [{ type: "bar", barWidth: 14, data: meses.map((m) => m.n), itemStyle: { color: AZUL_TVN, borderRadius: [3, 3, 0, 0] }, label: { show: true, position: "top", fontFamily: FUENTE, fontSize: 10, color: "#5b6572", formatter: (p: { dataIndex: number }) => `M ${fmt(meses[p.dataIndex].magMax, 1)}` } }],
  }), [meses]);
  return (
    <Grafica
      titulo="Sismos por mes"
      nota="Cantidad por mes; sobre cada barra, la magnitud máxima."
      aria={`Barras de sismos por mes de 2024, ${meses.length} meses`}
      opcion={opcion}
      alto={240}
      tabla={{ cabeceras: ["Mes", "Sismos", "Magnitud máxima"], filas: meses.map((m) => [m.mes, m.n, fmt(m.magMax, 1)]) }}
    />
  );
}
