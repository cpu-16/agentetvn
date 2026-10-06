import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dormir, fetchJson, gdeltFecha, nuevaNoticia } from "./comun";
import { sha256, type Noticia } from "../motor/contrato";

type Art = { url: string; title: string; seendate: string; domain: string; language: string; sourcecountry: string };

/** [consulta, días por ventana]: la amplia se parte en ventanas de 15 días (tope 250 por llamada); las temáticas van en una sola llamada de 90 días. */
export const CONSULTAS_GDELT: [string, number][] = [
  ["Panama sourcelang:spanish", 15],
  ["Panama domain:tvn-2.com", 30],
  ['"Canal de Panamá" sourcelang:spanish', 90],
  ["Panama turismo sourcelang:spanish", 90],
  ["Panama economía sourcelang:spanish", 90],
  ["Panama sismo sourcelang:spanish", 90],
];
const CACHE = "data/raw/gdelt";
/** Cada llamada se guarda en disco: reanudar no repite lo ya bajado. */
async function llamarConCache(url: string): Promise<{ articles?: Art[] }> {
  mkdirSync(CACHE, { recursive: true });
  const ruta = `${CACHE}/${sha256(url).slice(0, 16)}.json`;
  if (existsSync(ruta)) return JSON.parse(readFileSync(ruta, "utf8"));
  const j = await fetchJson<{ articles?: Art[] }>(url);
  writeFileSync(ruta, JSON.stringify({ url, bajado: new Date().toISOString(), ...j }));
  await dormir(8000); // límite público: 1 consulta cada 5 s (8 s evita el 429)
  return j;
}

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
  for (const [q, dias] of CONSULTAS_GDELT) {
    for (const v of ventanas(corte, 90, dias)) {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=${aGdelt(v.desde)}&enddatetime=${aGdelt(v.hasta)}`;
      let n = 0;
      try {
        const j = await llamarConCache(url);
        const ns = parsearGdelt(j.articles ?? [], fechaExtraccion);
        n = ns.length;
        todas.push(...ns);
      } catch (e) {
        log(`GDELT error ${q} ${aGdelt(v.desde)}: ${(e as Error).message.slice(0, 100)}`);
      }
      log(`GDELT «${q}» ${v.desde.toISOString().slice(0, 10)}→${v.hasta.toISOString().slice(0, 10)} · ${n}`);
      consultas.push({ fuente: "gdelt", consulta: url, fecha: fechaExtraccion, n });
    }
  }
  void fmt;
  return { noticias: todas, consultas };
}
