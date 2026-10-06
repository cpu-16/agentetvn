import { fetchJson } from "./comun";
import type { Indicador } from "../motor/contrato";

export const PAISES = ["PAN", "CRI", "COL", "DOM", "MEX", "GTM"];
export const INDICADORES: Record<string, { nombre: string; unidad: string }> = {
  "NY.GDP.MKTP.KD.ZG": { nombre: "Crecimiento del PIB (anual)", unidad: "% anual" },
  "FP.CPI.TOTL.ZG": { nombre: "Inflación, precios al consumidor (anual)", unidad: "% anual" },
  "SL.UEM.TOTL.ZS": { nombre: "Desempleo, total", unidad: "% de la fuerza laboral" },
  "SP.POP.TOTL": { nombre: "Población, total", unidad: "personas" },
  "IT.NET.USER.ZS": { nombre: "Personas que usan Internet", unidad: "% de la población" },
  "NE.EXP.GNFS.ZS": { nombre: "Exportaciones de bienes y servicios", unidad: "% del PIB" },
};
export const ANIOS = Array.from({ length: 15 }, (_, i) => 2010 + i);

type Fila = { countryiso3code: string; date: string; value: number | null; indicator: { id: string } };

/** Rellena la grilla completa país × indicador × año; lo que no venga queda en null. */
export function grilla(filas: Fila[], indicador: string, fechaExtraccion: string): Indicador[] {
  const idx = new Map(filas.map((f) => [`${f.countryiso3code}:${f.date}`, f.value]));
  const out: Indicador[] = [];
  for (const p of PAISES)
    for (const a of ANIOS)
      out.push({
        pais_iso3: p,
        indicador_id: indicador,
        anio: a,
        valor: idx.has(`${p}:${a}`) ? (idx.get(`${p}:${a}`) ?? null) : null,
        unidad: INDICADORES[indicador].unidad,
        fuente_url: `https://api.worldbank.org/v2/country/${p}/indicator/${indicador}?date=${a}&format=json`,
        fecha_extraccion: fechaExtraccion,
        licencia: "CC BY 4.0 (Banco Mundial)",
      });
  return out;
}

export async function ingestarBancoMundial(fechaExtraccion: string, log: (s: string) => void) {
  const todas: Indicador[] = [];
  const consultas: { fuente: string; consulta: string; fecha: string; n: number }[] = [];
  const crudo: Record<string, unknown> = {};
  for (const ind of Object.keys(INDICADORES)) {
    const url = `https://api.worldbank.org/v2/country/${PAISES.join(";")}/indicator/${ind}?date=2010:2024&format=json&per_page=200`;
    const j = await fetchJson<[unknown, Fila[]]>(url);
    crudo[ind] = j;
    const g = grilla(j[1] ?? [], ind, fechaExtraccion);
    const conValor = g.filter((x) => x.valor !== null).length;
    log(`BM ${ind} · ${g.length} celdas · ${conValor} con valor`);
    consultas.push({ fuente: "bancomundial", consulta: url, fecha: fechaExtraccion, n: g.length });
    todas.push(...g);
  }
  return { indicadores: todas, consultas, crudo };
}
