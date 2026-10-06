// Agregados del Tablero: puros y testeables. Nunca devuelven el snapshot entero.
import type { Snapshot } from "./cargar";
import { leerTemas } from "./config";
import { INDICADORES, PAISES } from "../ingesta/bancomundial";

export interface EventoTablero {
  id: string; titulo: string; tema: string; P: number; rango: "bajo" | "medio" | "alto";
  R: number; I: number; U: number; N: number; E: number;
  estado_evidencia: string; publicaciones: number; procedencias: number; fecha: string | null; medio: string; sintetica: boolean; no_confiable: boolean; por_revisar: boolean;
}
export interface Tablero {
  corteUTC: string; version: string;
  eventos: EventoTablero[];
  porDiaTema: { dia: string; tema: string; n: number }[];
  medios: { medio: string; publicaciones: number; eventos: number; agencia: boolean }[];
  procedencias: { tipo: "agencia" | "medio" | "primaria" | "no_verificada"; n: number }[];
  temas: { tema: string; nombre: string; eventos: number; publicaciones: number; P_mediana: number; por_revisar: number }[];
  evidencia: { tema: string; insuficiente: number; parcial: number; suficiente: number }[];
  indicadores: { indicador_id: string; nombre: string; unidad: string; series: { pais: string; puntos: [number, number | null][] }[] }[];
  sismos: { id: string; lat: number; lon: number; mag: number; depth: number; time: string; place: string; url: string }[];
  sismosPorMes: { mes: string; n: number; magMax: number }[];
  calidad: { noticias: number; tvn: number; sinFechaPublicacion: number; sinteticas: number; noConfiables: number; errores: number };
}

const diaPanama = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); // YYYY-MM-DD
const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

export function agregarTablero(snap: Snapshot): Tablero {
  const porId = new Map(snap.noticias.map((n) => [n.id_noticia, n]));
  const nombres = new Map(leerTemas().map((t) => [t.id, t.nombre]));
  const nombreTema = (id: string) => nombres.get(id) ?? id;

  const eventos: EventoTablero[] = snap.eventos.map((e) => {
    const rep = porId.get(e.representante);
    return {
      id: e.id, titulo: rep?.titulo ?? e.id, tema: e.tema, P: e.P, rango: e.rango,
      R: e.componentes.R, I: e.componentes.I, U: e.componentes.U, N: e.componentes.N, E: e.componentes.E,
      estado_evidencia: e.estado_evidencia, publicaciones: e.ids_noticia.length, procedencias: e.procedencias.length,
      fecha: e.fecha_original ?? rep?.fecha_deteccion ?? null, medio: rep?.medio ?? "", por_revisar: e.por_revisar, sintetica: e.ids_noticia.some((i) => porId.get(i)?.sintetica === true), no_confiable: e.no_confiable,
    };
  });

  // publicaciones por día (hora Panamá) y tema: cada noticia hereda el tema de su evento
  const temaDeNoticia = new Map<string, string>();
  for (const e of snap.eventos) for (const i of e.ids_noticia) temaDeNoticia.set(i, e.tema);
  const cuentaDia = new Map<string, number>();
  for (const n of snap.noticias) {
    const f = n.fecha_publicacion ?? n.fecha_deteccion;
    if (!f) continue;
    const k = `${diaPanama(f)}|${temaDeNoticia.get(n.id_noticia) ?? n.tema ?? "otro"}`;
    cuentaDia.set(k, (cuentaDia.get(k) ?? 0) + 1);
  }
  const porDiaTema = [...cuentaDia].map(([k, n]) => { const [dia, tema] = k.split("|"); return { dia, tema, n }; }).sort((a, b) => a.dia.localeCompare(b.dia) || a.tema.localeCompare(b.tema));

  // medios
  const medioMap = new Map<string, { publicaciones: number; eventos: Set<string>; agencia: boolean }>();
  for (const e of snap.eventos) for (const i of e.ids_noticia) {
    const n = porId.get(i); if (!n) continue;
    const m = medioMap.get(n.medio) ?? { publicaciones: 0, eventos: new Set<string>(), agencia: false };
    m.publicaciones++; m.eventos.add(e.id); if (n.agencia) m.agencia = true;
    medioMap.set(n.medio, m);
  }
  const medios = [...medioMap].map(([medio, m]) => ({ medio, publicaciones: m.publicaciones, eventos: m.eventos.size, agencia: m.agencia })).sort((a, b) => b.publicaciones - a.publicaciones).slice(0, 25);

  const procMap = new Map<Tablero["procedencias"][number]["tipo"], number>();
  for (const e of snap.eventos) for (const p of e.procedencias) procMap.set(p.tipo, (procMap.get(p.tipo) ?? 0) + 1);
  const procedencias = (["agencia", "medio", "primaria", "no_verificada"] as const).map((tipo) => ({ tipo, n: procMap.get(tipo) ?? 0 }));

  const temasIds = [...new Set(snap.eventos.map((e) => e.tema))];
  const temas = temasIds.map((tema) => {
    const evs = snap.eventos.filter((e) => e.tema === tema);
    return { tema, nombre: nombreTema(tema), eventos: evs.length, publicaciones: evs.reduce((s, e) => s + e.ids_noticia.length, 0), P_mediana: r2(mediana(evs.map((e) => e.P))), por_revisar: evs.filter((e) => e.por_revisar).length };
  }).sort((a, b) => b.publicaciones - a.publicaciones);

  const evidencia = temasIds.map((tema) => {
    const evs = snap.eventos.filter((e) => e.tema === tema);
    return { tema, insuficiente: evs.filter((e) => e.estado_evidencia === "insuficiente").length, parcial: evs.filter((e) => e.estado_evidencia === "parcial").length, suficiente: evs.filter((e) => e.estado_evidencia === "suficiente").length };
  }).sort((a, b) => (b.insuficiente + b.parcial + b.suficiente) - (a.insuficiente + a.parcial + a.suficiente));

  const anios = Array.from({ length: 15 }, (_, i) => 2010 + i);
  const indicadores = Object.entries(INDICADORES).map(([indicador_id, def]) => ({
    indicador_id, nombre: def.nombre, unidad: def.unidad,
    series: PAISES.map((pais) => ({ pais, puntos: anios.map((a): [number, number | null] => [a, snap.indicadores.find((i) => i.pais_iso3 === pais && i.indicador_id === indicador_id && i.anio === a)?.valor ?? null]) })),
  }));

  const sismos = snap.sismos.map((s) => ({ id: s.id, lat: s.latitude, lon: s.longitude, mag: s.magnitude, depth: s.depth, time: s.time, place: s.place, url: s.url }));
  const mesMap = new Map<string, { n: number; magMax: number }>();
  for (const s of sismos) {
    const mes = s.time.slice(0, 7);
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

  return { corteUTC: snap.manifest.fecha_corte_UTC, version: snap.manifest.version, eventos, porDiaTema, medios, procedencias, temas, evidencia, indicadores, sismos, sismosPorMes, calidad };
}
