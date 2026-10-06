import { dormir, fetchJson, gdeltFecha, nuevaNoticia } from "./comun";
import type { Noticia } from "../motor/contrato";

type Art = { url: string; title: string; seendate: string; domain: string; language: string; sourcecountry: string };

export const CONSULTAS_GDELT = [
  "Panama sourcelang:spanish",
  '"Canal de Panamá" sourcelang:spanish',
  "Panama turismo sourcelang:spanish",
  "Panama economía sourcelang:spanish",
  "Panama sismo sourcelang:spanish",
  "Panama domain:tvn-2.com",
];

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z".replace("Z", "") ;
const aGdelt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14);

/** Ventanas de `dias` días hacia atrás desde `corte`, cubriendo `totalDias`. */
export function ventanas(corte: Date, totalDias = 90, dias = 15): { desde: Date; hasta: Date }[] {
  const out: { desde: Date; hasta: Date }[] = [];
  let hasta = new Date(corte);
  const limite = new Date(corte.getTime() - totalDias * 86400000);
  while (hasta > limite) {
    const desde = new Date(Math.max(hasta.getTime() - dias * 86400000, limite.getTime()));
    out.push({ desde, hasta });
    hasta = desde;
  }
  return out;
}

export function parsearGdelt(arts: Art[], fechaExtraccion: string): Noticia[] {
  return arts
    .filter((a) => a.url && a.title)
    .map((a) =>
      nuevaNoticia({
        titulo: a.title.replace(/\s+/g, " ").trim(),
        descripcion: "",
        url: a.url,
        medio: a.domain === "tvn-2.com" ? "TVN" : a.domain,
        idioma: a.language === "Spanish" ? "es" : a.language,
        fecha_publicacion: null, // GDELT solo informa detección
        fecha_deteccion: gdeltFecha(a.seendate),
        fecha_extraccion: fechaExtraccion,
        origen: "gdelt",
      })
    );
}

export async function ingestarGdelt(corte: Date, fechaExtraccion: string, log: (s: string) => void) {
  const todas: Noticia[] = [];
  const consultas: { fuente: string; consulta: string; fecha: string; n: number }[] = [];
  for (const q of CONSULTAS_GDELT) {
    for (const v of ventanas(corte)) {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=${aGdelt(v.desde)}&enddatetime=${aGdelt(v.hasta)}`;
      let n = 0;
      try {
        const j = await fetchJson<{ articles?: Art[] }>(url);
        const ns = parsearGdelt(j.articles ?? [], fechaExtraccion);
        n = ns.length;
        todas.push(...ns);
      } catch (e) {
        log(`GDELT error ${q} ${aGdelt(v.desde)}: ${(e as Error).message.slice(0, 100)}`);
      }
      log(`GDELT «${q}» ${v.desde.toISOString().slice(0, 10)}→${v.hasta.toISOString().slice(0, 10)} · ${n}`);
      consultas.push({ fuente: "gdelt", consulta: url, fecha: fechaExtraccion, n });
      await dormir(5500); // límite público: 1 consulta cada 5 s
    }
  }
  void fmt;
  return { noticias: todas, consultas };
}
