// Agregados del Tablero: puros y testeables. Nunca devuelven el snapshot entero.
// El servidor entrega los eventos con sus publicaciones (día en hora Panamá y medio); el cliente aplica
// UN solo filtro a nivel de publicación con `filtrarDatos` (tablero-filtro.ts), y de ahí salen todas las gráficas y tarjetas.
import type { Snapshot } from "./cargar";
import { leerTemas } from "./config";
import { INDICADORES, PAISES } from "../ingesta/bancomundial";
import { diaPanama, filtrarDatos, FILTRO_VACIO, mesPanama, type EventoTablero, type PublicacionTablero, type Tablero } from "./tablero-filtro";
import type { Noticia } from "./contrato";
export * from "./tablero-filtro";

let nombres: Map<string, string> | null = null;
export const nombreTemaServidor = (id: string) => (nombres ??= new Map(leerTemas().map((t) => [t.id, t.nombre]))).get(id) ?? id;

/** Lo que entra al tablero y a las cifras de la portada: publicaciones reales y confiables. Los casos sintéticos de prueba
 *  y las fuentes no confiables quedan fuera (en la agenda siguen visibles y marcados). */
export const entraAlTablero = (n: Noticia) => !n.sintetica && !n.no_confiable;

/** Eventos del tablero: solo sus publicaciones reales y confiables; un evento sin ninguna queda fuera. */
export function eventosTablero(snap: Snapshot): EventoTablero[] {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  return snap.eventos.flatMap((e) => {
    const rep = porId.get(e.representante);
    const procDe = new Map(e.procedencias.flatMap((p) => p.ids_noticia.map((i) => [i, p] as const)));
    const pubs: PublicacionTablero[] = e.ids_noticia.map((i) => porId.get(i)).filter((n): n is Noticia => !!n && entraAlTablero(n)).map((n) => {
      const f = n.fecha_publicacion ?? n.fecha_deteccion;
      const proc = procDe.get(n.id_noticia);
      return { dia: f ? diaPanama(f) : null, medio: n.medio, agencia: n.agencia ?? null, proc: proc?.id ?? `medio:${n.medio}`, procTipo: proc?.tipo ?? "medio", deteccion: !n.fecha_publicacion };
    });
    if (!pubs.length) return [];
    return [{
      id: e.id, titulo: rep?.titulo ?? e.id, tema: e.tema, P: e.P, rango: e.rango,
      R: e.componentes.R, I: e.componentes.I, U: e.componentes.U, N: e.componentes.N, E: e.componentes.E,
      estado_evidencia: e.estado_evidencia, publicaciones: pubs.length, procedencias: new Set(pubs.map((p) => p.proc)).size,
      fecha: e.fecha_original ?? rep?.fecha_deteccion ?? null, medio: rep?.medio ?? "", por_revisar: e.por_revisar, sintetica: false, no_confiable: false,
      pubs, dias: [...new Set(pubs.map((p) => p.dia).filter((d): d is string => !!d))].sort(),
    }];
  });
}

/** Cifras del corte con UNA definición, compartidas por la portada (vía agenda) y el tablero. */
export function resumenCorte(snap: Snapshot) {
  const a = filtrarDatos(eventosTablero(snap), FILTRO_VACIO);
  return {
    publicaciones: a.publicaciones,
    eventos: a.eventos.length,
    medios: a.mediosDistintos,
    agencias: a.agenciasDistintas,
    sinteticas: snap.noticias.filter((n) => n.sintetica).length,
    noConfiablesReales: snap.noticias.filter((n) => n.no_confiable && !n.sintetica).length,
  };
}

export function agregarTablero(snap: Snapshot): Tablero {
  const eventos = eventosTablero(snap);
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

  const enTablero = snap.noticias.filter(entraAlTablero);
  const calidad = {
    noticias: snap.noticias.length,
    tablero: enTablero.length,
    tvn: enTablero.filter((n) => n.medio === "TVN").length,
    sinFechaPublicacion: enTablero.filter((n) => !n.fecha_publicacion).length,
    sinteticas: snap.noticias.filter((n) => n.sintetica).length,
    noConfiables: snap.noticias.filter((n) => n.no_confiable).length,
    noConfiablesReales: snap.noticias.filter((n) => n.no_confiable && !n.sintetica).length,
    errores: snap.errores.length,
  };

  return { corteUTC: snap.manifest.fecha_corte_UTC, version: snap.manifest.version, ...agregados, indicadores, sismos, sismosPorMes, calidad };
}
