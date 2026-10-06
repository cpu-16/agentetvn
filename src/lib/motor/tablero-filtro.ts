// Tipos y filtro del Tablero: módulo PURO (sin fs ni config) para que el cliente lo importe y comparta la misma lógica con el servidor.

export interface PublicacionTablero { dia: string | null; medio: string; agencia: string | null }
export interface EventoTablero {
  id: string; titulo: string; tema: string; P: number; rango: "bajo" | "medio" | "alto";
  R: number; I: number; U: number; N: number; E: number;
  estado_evidencia: string; publicaciones: number; procedencias: number; fecha: string | null; medio: string; sintetica: boolean; no_confiable: boolean; por_revisar: boolean;
  pubs: PublicacionTablero[];
  dias: string[]; // días (hora Panamá) de sus publicaciones con fecha
  procTipos: Record<"agencia" | "medio" | "primaria" | "no_verificada", number>;
}
export interface Filtro { temas: string[]; rango: ("bajo" | "medio" | "alto")[]; desde?: string; hasta?: string; medio?: string }
export const FILTRO_VACIO: Filtro = { temas: [], rango: [] };
export const hayFiltro = (f: Filtro) => f.temas.length > 0 || f.rango.length > 0 || !!f.desde || !!f.hasta || !!f.medio;

export interface Agregados {
  eventos: EventoTablero[];
  publicaciones: number; // publicaciones que cumplen el filtro (período y medio incluidos)
  mediosDistintos: number; // medios y agencias distintos entre esas publicaciones
  porDiaTema: { dia: string; tema: string; n: number }[];
  medios: { medio: string; publicaciones: number; eventos: number; agencia: boolean }[];
  procedencias: { tipo: "agencia" | "medio" | "primaria" | "no_verificada"; n: number }[];
  temas: { tema: string; nombre: string; eventos: number; publicaciones: number; P_mediana: number; por_revisar: number }[];
  evidencia: { tema: string; insuficiente: number; parcial: number; suficiente: number }[];
}
export interface Tablero extends Agregados {
  corteUTC: string; version: string;
  indicadores: { indicador_id: string; nombre: string; unidad: string; series: { pais: string; puntos: [number, number | null][] }[] }[];
  sismos: { id: string; lat: number; lon: number; mag: number; depth: number; time: string; place: string; url: string }[];
  sismosPorMes: { mes: string; n: number; magMax: number }[];
  calidad: { noticias: number; tvn: number; sinFechaPublicacion: number; sinteticas: number; noConfiables: number; errores: number };
}

const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD en hora de Panamá (la misma zona en el servidor y en la UI). */
export const diaPanama = (iso: string) => fmtDia.format(new Date(iso));
/** YYYY-MM en hora de Panamá. */
export const mesPanama = (iso: string) => diaPanama(iso).slice(0, 7);
/** Mediana real: con n par, promedio de los dos centrales. */
export function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Una publicación entra en el período si su día (Panamá) cae en [desde, hasta]; sin fecha no entra en un período acotado. */
const pubEnFiltro = (p: PublicacionTablero, f: Filtro, ignorarMedio = false) => {
  if ((f.desde || f.hasta) && !p.dia) return false;
  if (f.desde && p.dia! < f.desde) return false;
  if (f.hasta && p.dia! > f.hasta) return false;
  if (!ignorarMedio && f.medio && p.medio !== f.medio) return false;
  return true;
};

/**
 * Aplica el filtro compartido a nivel de PUBLICACIÓN y devuelve el conjunto completo para el tablero.
 * Un evento queda si pertenece a los temas/rangos pedidos y tiene al menos una publicación que cumpla período y medio.
 * `medios` se calcula sin el filtro de medio (para poder cambiar de medio desde la gráfica) y marca el activo en la UI.
 */
export function filtrarDatos(eventos: EventoTablero[], f: Filtro, nombreTema: (id: string) => string = (id) => id): Agregados {
  const pasaEvento = (e: EventoTablero) => (!f.temas.length || f.temas.includes(e.tema)) && (!f.rango.length || f.rango.includes(e.rango));
  const filtrados = eventos.filter((e) => pasaEvento(e) && e.pubs.some((p) => pubEnFiltro(p, f)));

  let publicaciones = 0;
  const mediosYAgencias = new Set<string>();
  const cuentaDia = new Map<string, number>();
  const medioMap = new Map<string, { publicaciones: number; eventos: Set<string>; agencia: boolean }>();
  const procMap = new Map<Agregados["procedencias"][number]["tipo"], number>();
  for (const e of filtrados) {
    for (const p of e.pubs) {
      if (pubEnFiltro(p, f, true)) {
        // medios: sin el filtro de medio, para que la gráfica siga mostrando las alternativas
        const m = medioMap.get(p.medio) ?? { publicaciones: 0, eventos: new Set<string>(), agencia: false };
        m.publicaciones++; m.eventos.add(e.id); if (p.agencia) m.agencia = true;
        medioMap.set(p.medio, m);
      }
      if (!pubEnFiltro(p, f)) continue;
      publicaciones++;
      mediosYAgencias.add(p.agencia ? `agencia:${p.agencia}` : `medio:${p.medio}`);
      if (p.dia) { const k = `${p.dia}|${e.tema}`; cuentaDia.set(k, (cuentaDia.get(k) ?? 0) + 1); }
    }
    for (const [tipo, n] of Object.entries(e.procTipos) as [Agregados["procedencias"][number]["tipo"], number][]) procMap.set(tipo, (procMap.get(tipo) ?? 0) + n);
  }
  const porDiaTema = [...cuentaDia].map(([k, n]) => { const [dia, tema] = k.split("|"); return { dia, tema, n }; }).sort((a, b) => a.dia.localeCompare(b.dia) || a.tema.localeCompare(b.tema));
  const medios = [...medioMap].map(([medio, m]) => ({ medio, publicaciones: m.publicaciones, eventos: m.eventos.size, agencia: m.agencia })).sort((a, b) => b.publicaciones - a.publicaciones || a.medio.localeCompare(b.medio)).slice(0, 25);
  const procedencias = (["agencia", "medio", "primaria", "no_verificada"] as const).map((tipo) => ({ tipo, n: procMap.get(tipo) ?? 0 }));
  const temasIds = [...new Set(filtrados.map((e) => e.tema))];
  const temas = temasIds.map((tema) => {
    const evs = filtrados.filter((e) => e.tema === tema);
    return { tema, nombre: nombreTema(tema), eventos: evs.length, publicaciones: evs.reduce((s, e) => s + e.pubs.filter((p) => pubEnFiltro(p, f)).length, 0), P_mediana: r2(mediana(evs.map((e) => e.P))), por_revisar: evs.filter((e) => e.por_revisar).length };
  }).sort((a, b) => b.publicaciones - a.publicaciones);
  const evidencia = temasIds.map((tema) => {
    const evs = filtrados.filter((e) => e.tema === tema);
    return { tema, insuficiente: evs.filter((e) => e.estado_evidencia === "insuficiente").length, parcial: evs.filter((e) => e.estado_evidencia === "parcial").length, suficiente: evs.filter((e) => e.estado_evidencia === "suficiente").length };
  }).sort((a, b) => (b.insuficiente + b.parcial + b.suficiente) - (a.insuficiente + a.parcial + a.suficiente));
  return { eventos: filtrados, publicaciones, mediosDistintos: mediosYAgencias.size, porDiaTema, medios, procedencias, temas, evidencia };
}

