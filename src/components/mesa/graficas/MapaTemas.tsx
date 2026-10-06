"use client";
import { useMemo } from "react";
import { AccionTabla, Grafica, type Manejadores, type Opcion } from "./Grafica";
import { colorTema, FUENTE, FUENTE_DISPLAY, nombreTema, RAMPA_AZUL_OSCURA, TOOLTIP, esc, fmt } from "./paleta";
import type { Agregados, EventoTablero, Filtro } from "./tipos";

interface Props { temas: Agregados["temas"]; eventos: EventoTablero[]; filtro: Filtro; onFiltro: (f: Partial<Filtro>) => void; abrirFicha: (id: string) => void }

// Dos vistas con UNA codificación de color cada una:
// · temas: color categórico del tema (el mismo de todo el tablero), tamaño = publicaciones.
// · eventos de un solo tema: rampa azul por P (texto blanco legible), tamaño = publicaciones; «por revisar» con borde punteado y sufijo.
export function MapaTemas({ temas, eventos, filtro, onFiltro, abrirFicha }: Props) {
  const unSoloTema = filtro.temas.length === 1;
  const evsTema = useMemo(() => (unSoloTema ? eventos.filter((e) => e.tema === filtro.temas[0]) : []), [eventos, filtro.temas, unSoloTema]);

  const datosTemas = useMemo(() => temas.map((t) => ({
    name: nombreTema(t.tema), tema: t.tema, value: [t.publicaciones, t.P_mediana, t.eventos, t.por_revisar],
    itemStyle: { color: colorTema(t.tema), borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
  })), [temas]);
  const datosEventos = useMemo(() => evsTema.map((e) => ({
    name: e.por_revisar ? `${e.titulo} (por revisar)` : e.titulo, id: e.id, value: [e.publicaciones, e.P],
    itemStyle: e.por_revisar ? { borderColor: "#0f1b2d", borderWidth: 1.5, borderType: "dashed" } : {},
  })), [evsTema]);

  const arr = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : [v as number]);
  const [pMin, pMax] = useMemo(() => { const ps = evsTema.map((e) => e.P); return ps.length ? [Math.floor(Math.min(...ps) / 5) * 5, Math.ceil(Math.max(...ps) / 5) * 5] : [0, 100]; }, [evsTema]);
  const opcion = useMemo<Opcion>(() => (unSoloTema ? {
    tooltip: { ...TOOLTIP, formatter: (p: { name: string; value: unknown }) => { const v = arr(p.value); return `<strong>${esc(p.name)}</strong><br/>${fmt(v[0])} publicaciones, P ${fmt(v[1], 1)}`; } },
    visualMap: { type: "continuous", min: pMin, max: pMax === pMin ? pMin + 1 : pMax, dimension: 1, inRange: { color: RAMPA_AZUL_OSCURA }, text: [`P ${pMax}`, `P ${pMin}`], orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120, textStyle: { fontFamily: FUENTE, fontSize: 10, color: "#5b6572" }, seriesIndex: 0 },
    series: [{
      type: "treemap", roam: false, nodeClick: false, width: "100%", height: "88%", top: 0, breadcrumb: { show: false },
      label: { show: true, fontFamily: FUENTE_DISPLAY, fontSize: 12, color: "#fff", overflow: "truncate" },
      itemStyle: { borderColor: "#fff", borderWidth: 1, gapWidth: 2 },
      data: datosEventos,
    }],
  } : {
    tooltip: { ...TOOLTIP, formatter: (p: { name: string; value: unknown }) => { const v = arr(p.value); return `<strong>${esc(p.name)}</strong><br/>${fmt(v[2])} eventos, ${fmt(v[0])} publicaciones<br/>P mediana ${fmt(v[1], 1)}; ${fmt(v[3])} por revisar`; } },
    series: [{
      type: "treemap", roam: false, nodeClick: false, width: "100%", height: "100%", top: 0, breadcrumb: { show: false },
      label: { show: true, fontFamily: FUENTE_DISPLAY, fontSize: 13, color: "#fff", overflow: "truncate", formatter: (p: { name: string; value: unknown }) => `${p.name}\n${fmt(arr(p.value)[2])} eventos` },
      data: datosTemas,
    }],
  }), [unSoloTema, datosTemas, datosEventos, pMin, pMax]);

  const eventosGr = useMemo<Manejadores>(() => ({
    click: (p) => {
      const d = p as { data?: { id?: string; tema?: string } };
      if (d.data?.id) abrirFicha(d.data.id);
      else if (d.data?.tema) onFiltro({ temas: filtro.temas.length === 1 && filtro.temas[0] === d.data.tema ? [] : [d.data.tema] });
    },
  }), [abrirFicha, onFiltro, filtro.temas]);

  const tabla = useMemo(() => (unSoloTema
    ? { cabeceras: ["Evento", "Publicaciones", "P", "Por revisar"], filas: evsTema.map((e) => [e.titulo, e.publicaciones, e.P, e.por_revisar ? "sí" : "no"]), accion: (_: unknown, i: number) => <AccionTabla onClick={() => abrirFicha(evsTema[i].id)}>Abrir ficha</AccionTabla>, nota: "Mismo conjunto que la gráfica (filtro aplicado)." }
    : { cabeceras: ["Tema", "Eventos", "Publicaciones", "P mediana", "Por revisar"], filas: temas.map((t) => [nombreTema(t.tema), t.eventos, t.publicaciones, t.P_mediana, t.por_revisar]), accion: (_: unknown, i: number) => <AccionTabla pressed={filtro.temas.includes(temas[i].tema)} onClick={() => onFiltro({ temas: filtro.temas.length === 1 && filtro.temas[0] === temas[i].tema ? [] : [temas[i].tema] })}>Filtrar</AccionTabla>, nota: "Mismo conjunto que la gráfica (filtro aplicado)." }
  ), [unSoloTema, evsTema, temas, filtro.temas, abrirFicha, onFiltro]);

  return (
    <Grafica
      titulo="Mapa de temas"
      nota={unSoloTema ? `Eventos de ${nombreTema(filtro.temas[0])}: tamaño, publicaciones; color, puntaje de atención (P); borde punteado, por revisar. Clic abre la ficha; «Limpiar» vuelve a los temas.` : "Tamaño: publicaciones. Color: el del tema en todo el tablero. Clic en un tema filtra el tablero y muestra sus eventos."}
      aria={unSoloTema ? `Mapa de ${evsTema.length} eventos del tema ${nombreTema(filtro.temas[0])}` : `Mapa de ${temas.length} temas con ${eventos.length} eventos`}
      opcion={opcion}
      eventos={eventosGr}
      alto={360}
      tabla={tabla}
      reemplazar={["series", "visualMap"]}
    />
  );
}
