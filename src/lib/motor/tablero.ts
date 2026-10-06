// Agregados del Tablero: puros y testeables. Nunca devuelven el snapshot entero.
// El servidor entrega los eventos con sus publicaciones (día en hora Panamá y medio); el cliente aplica
// UN solo filtro a nivel de publicación con `filtrarDatos` (tablero-filtro.ts), y de ahí salen todas las gráficas y tarjetas.
import type { Snapshot } from "./cargar";
import { leerTemas } from "./config";
import { INDICADORES, PAISES } from "../ingesta/bancomundial";
import { diaPanama, filtrarDatos, FILTRO_VACIO, mesPanama, type EventoTablero, type PublicacionTablero, type Tablero } from "./tablero-filtro";
export * from "./tablero-filtro";

let nombres: Map<string, string> | null = null;
export const nombreTemaServidor = (id: string) => (nombres ??= new Map(leerTemas().map((t) => [t.id, t.nombre]))).get(id) ?? id;

export function agregarTablero(snap: Snapshot): Tablero {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));

  const eventos: EventoTablero[] = snap.eventos.map((e) => {
    const rep = porId.get(e.representante);
    const pubs: PublicacionTablero[] = e.ids_noticia.map((i) => porId.get(i)).filter((n): n is NonNullable<typeof n> => !!n).map((n) => {
      const f = n.fecha_publicacion ?? n.fecha_deteccion;
      return { dia: f ? diaPanama(f) : null, medio: n.medio, agencia: n.agencia ?? null };
    });
    const procTipos = { agencia: 0, medio: 0, primaria: 0, no_verificada: 0 };
    for (const p of e.procedencias) procTipos[p.tipo]++;
    return {
      id: e.id, titulo: rep?.titulo ?? e.id, tema: e.tema, P: e.P, rango: e.rango,
      R: e.componentes.R, I: e.componentes.I, U: e.componentes.U, N: e.componentes.N, E: e.componentes.E,
      estado_evidencia: e.estado_evidencia, publicaciones: pubs.length, procedencias: e.procedencias.length,
      fecha: e.fecha_original ?? rep?.fecha_deteccion ?? null, medio: rep?.medio ?? "", por_revisar: e.por_revisar, sintetica: e.ids_noticia.some((i) => porId.get(i)?.sintetica === true), no_confiable: e.no_confiable,
      pubs, dias: [...new Set(pubs.map((p) => p.dia).filter((d): d is string => !!d))].sort(), procTipos,
    };
  });

  const agregados = filtrarDatos(eventos, FILTRO_VACIO, nombreTemaServidor);

  const anios = Array.from({ length: 15 }, (_, i) => 2010 + i);
  const indicadores = Object.entries(INDICADORES).map(([indicador_id, def]) => ({
    indicador_id, nombre: def.nombre, unidad: def.unidad,
    series: PAISES.map((pais) => ({ pais, puntos: anios.map((a): [number, number | null] => [a, snap.indicadores.find((i) => i.pais_iso3 === pais && i.indicador_id === indicador_id && i.anio === a)?.valor ?? null]) })),
  }));

  const sismos = snap.sismos.map((s) => ({ id: s.id, lat: s.latitude, lon: s.longitude, mag: s.magnitude, depth: s.depth, time: s.time, place: s.place, url: s.url }));
  const mesMap = new Map<string, { n: number; magMax: number }>();
  for (const s of sismos) {
    const mes = mesPanama(s.time); // misma zona que la fecha del tooltip
    const m = mesMap.get(mes) ?? { n: 0, magMax: 0 };
    m.n++; m.magMax = Math.max(m.magMax, s.mag);
    mesMap.set(mes, m);
  }
  const sismosPorMes = [...mesMap].map(([mes, m]) => ({ mes, ...m })).sort((a, b) => a.mes.localeCompare(b.mes));

  const calidad = {
    noticias: snap.noticias.length,
    tvn: snap.noticias.filter((n) => n.medio === "TVN").length,
    sinFechaPublicacion: snap.noticias.filter((n) => !n.fecha_publicacion).length,
    sinteticas: snap.noticias.filter((n) => n.sintetica).length,
    noConfiables: snap.noticias.filter((n) => n.no_confiable).length,
    errores: snap.errores.length,
  };

  return { corteUTC: snap.manifest.fecha_corte_UTC, version: snap.manifest.version, ...agregados, indicadores, sismos, sismosPorMes, calidad };
}
