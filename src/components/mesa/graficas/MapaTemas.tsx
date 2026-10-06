"use client";
import { useMemo } from "react";
import { Grafica, type Manejadores, type Opcion } from "./Grafica";
import { colorTema, FUENTE, FUENTE_DISPLAY, nombreTema, RAMPA_AZUL, TOOLTIP, esc, fmt } from "./paleta";
import type { EventoTablero, Filtro } from "./tipos";

interface Props { eventos: EventoTablero[]; filtro: Filtro; onFiltro: (f: Partial<Filtro>) => void; abrirFicha: (id: string) => void }

export function MapaTemas({ eventos, filtro, onFiltro, abrirFicha }: Props) {
  const arbol = useMemo(() => {
    const porTema = new Map<string, EventoTablero[]>();
    for (const e of eventos) porTema.set(e.tema, [...(porTema.get(e.tema) ?? []), e]);
    return [...porTema].map(([tema, evs]) => {
      const ps = evs.map((e) => e.P).sort((a, b) => a - b);
      return {
        name: nombreTema(tema),
        tema,
        value: [evs.reduce((s, e) => s + e.publicaciones, 0), ps[Math.floor(ps.length / 2)] ?? 0],
        itemStyle: { color: colorTema(tema), borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
        children: evs.map((e) => ({
          name: e.titulo, id: e.id,
          value: [e.publicaciones, e.P],
          itemStyle: { ...(e.por_revisar ? { decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: Math.PI / 4, color: "rgba(255,255,255,.45)" } } : {}) },
        })),
      };
    }).sort((a, b) => (b.value[0] as number) - (a.value[0] as number));
  }, [eventos]);
  // con un solo tema activo, los eventos pasan a ser el primer nivel (no hace falta un segundo clic)
  const unSoloTema = filtro.temas.length === 1 && arbol.length === 1;
  const datosTreemap = unSoloTema ? arbol[0].children : arbol; // sin color fijo: el visualMap pinta cada evento por su P

  const opcion = useMemo<Opcion>(() => ({
    tooltip: { ...TOOLTIP, formatter: (p: { name: string; value: number[]; treePathInfo?: { name: string }[] }) => `<strong>${esc(p.name)}</strong><br/>${fmt(p.value[0])} publicaciones<br/>P ${p.treePathInfo && p.treePathInfo.length > 2 ? "" : "mediana "}${fmt(p.value[1], 1)}` },
    visualMap: { type: "continuous", min: 0, max: 100, dimension: 1, inRange: { color: RAMPA_AZUL }, text: ["P 100", "P 0"], orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120, textStyle: { fontFamily: FUENTE, fontSize: 10, color: "#5b6572" }, seriesIndex: 0 },
    series: [{
      type: "treemap", roam: false, nodeClick: "link", leafDepth: unSoloTema ? undefined : 1, width: "100%", height: "86%", top: 0,
      breadcrumb: { show: true, height: 20, itemStyle: { color: "#f3f5f8", textStyle: { color: "#0f1b2d", fontFamily: FUENTE } } },
      label: { show: true, fontFamily: FUENTE_DISPLAY, fontSize: 13, color: "#fff", overflow: "truncate" },
      upperLabel: { show: true, height: 22, fontFamily: FUENTE_DISPLAY, fontSize: 12, color: "#fff" },
      levels: [
        { itemStyle: { borderWidth: 0, gapWidth: 3 }, colorMappingBy: "id", visualDimension: 1, color: undefined },
        { itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 }, label: { fontSize: 11 } },
      ],
      data: datosTreemap,
    }],
  }), [arbol, datosTreemap, unSoloTema]);

  const eventosGr = useMemo<Manejadores>(() => ({
    click: (p) => {
      const d = p as { data?: { id?: string; tema?: string }; treePathInfo?: unknown[] };
      if (d.data?.id) abrirFicha(d.data.id);
      else if (d.data?.tema) onFiltro({ temas: filtro.temas.length === 1 && filtro.temas[0] === d.data.tema ? [] : [d.data.tema] });
    },
  }), [abrirFicha, onFiltro, filtro.temas]);

  const tabla = useMemo(() => ({ cabeceras: ["Tema", "Eventos", "Publicaciones", "P mediana"], filas: arbol.map((t) => [t.name, t.children.length, t.value[0] as number, t.value[1] as number]) }), [arbol]);

  return (
    <Grafica
      titulo="Mapa de temas"
      nota={unSoloTema ? `Eventos de ${arbol[0].name}: tamaño, publicaciones; color, puntaje de atención; trama, por revisar. Clic abre la ficha. «Limpiar» vuelve a los temas.` : "Tamaño: publicaciones. Color: puntaje de atención mediano. Trama: por revisar. Clic en un tema filtra el tablero y muestra sus eventos; clic en un evento abre su ficha."}
      aria={`Mapa de temas con ${arbol.length} temas y ${eventos.length} eventos`}
      opcion={opcion}
      eventos={eventosGr}
      alto={360}
      tabla={tabla}
    />
  );
}
