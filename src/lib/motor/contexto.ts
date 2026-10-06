// Contextualizar sin forzar: una noticia se liga a un indicador o a un sismo solo con señal explícita.
import type { Indicador, Sismo, Contexto } from "./contrato";

export const CONCEPTO_INDICADOR: { re: RegExp; id: string }[] = [
  { re: /inflaci[oó]n|[ií]ndice de precios|ipc\b/i, id: "FP.CPI.TOTL.ZG" },
  { re: /desempleo|desocupaci[oó]n|tasa de empleo/i, id: "SL.UEM.TOTL.ZS" },
  { re: /exportaci[oó]n/i, id: "NE.EXP.GNFS.ZS" },
  { re: /\bpib\b|producto interno|crecimiento econ[oó]mico|econom[ií]a crec/i, id: "NY.GDP.MKTP.KD.ZG" },
  { re: /internet|conectividad digital|banda ancha/i, id: "IT.NET.USER.ZS" },
  { re: /poblaci[oó]n|censo|habitantes/i, id: "SP.POP.TOTL" },
];

export const idIndicador = (i: Indicador) => `${i.pais_iso3}:${i.indicador_id}:${i.anio}`;

/** Último año con valor no nulo para un país e indicador. */
export function ultimoConValor(indicadores: Indicador[], pais: string, indicador: string): Indicador | null {
  return indicadores.filter((i) => i.pais_iso3 === pais && i.indicador_id === indicador && i.valor !== null).sort((a, b) => b.anio - a.anio)[0] ?? null;
}

const mencionaPanama = (place: string) => /panam/i.test(place);
const dias = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;

const OTRO_PAIS = /\b(costa rica|colombia|m[eé]xico|guatemala|honduras|nicaragua|el salvador|venezuela|ecuador|per[uú]|chile|argentina|brasil|espa[ñn]a|estados unidos|eeuu|rep[uú]blica dominicana|europa|china|rusia)\b/i;
const DE_PANAMA = /panam[aá]|panameñ|\bacp\b|\binec\b|\bmef\b|\bcss\b|chiriqu[ií]|col[oó]n|azuero|bocas del toro|veraguas|dari[eé]n/i;

export function vincularContexto(texto: string, tema: string, fechaRef: string | null, indicadores: Indicador[], sismos: Sismo[]): Contexto {
  const out: Contexto = { indicadores: [], sismos: [] };
  // una noticia que habla de otro país no se liga a la serie de Panamá (no forzar relaciones)
  if (tema === "economia" && !(OTRO_PAIS.test(texto) && !DE_PANAMA.test(texto))) {
    for (const c of CONCEPTO_INDICADOR) {
      if (!c.re.test(texto)) continue;
      const fila = ultimoConValor(indicadores, "PAN", c.id);
      if (fila) out.indicadores.push(idIndicador(fila));
    }
  }
  if (tema === "eventos_naturales" && /sismo|temblor|terremoto/i.test(texto) && fechaRef) {
    out.sismos = sismos.filter((s) => mencionaPanama(s.place) && dias(s.time, fechaRef) <= 7).map((s) => s.id);
  }
  return out;
}
