import { XMLParser } from "fast-xml-parser";
import { aISO, nuevaNoticia } from "./comun";
import type { Noticia } from "../motor/contrato";

export const SECCIONES_TVN = ["nacionales", "economia", "politica", "provincias", "salud", "tecnologia", "deportes", "mundo", "internacionales", "judicial", "seguridad", "sociedad", "clima"];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/** Convierte el XML de un feed de TVN en noticias. Exportado para probar con fixtures. */
export function parsearRssTvn(xml: string, seccion: string, fechaExtraccion: string): Noticia[] {
  if (!xml.trimStart().startsWith("<?xml") && !xml.trimStart().startsWith("<rss")) return [];
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  const lista = Array.isArray(items) ? items : items ? [items] : [];
  return lista
    .filter((it) => it?.link && it?.title)
    .map((it) =>
      nuevaNoticia({
        titulo: String(it.title).trim(),
        descripcion: String(it.description ?? "").replace(/<[^>]+>/g, "").trim(),
        url: String(it.link),
        medio: "TVN",
        idioma: "es",
        fecha_publicacion: aISO(it.pubDate),
        fecha_deteccion: null,
        fecha_extraccion: fechaExtraccion,
        origen: "tvn_rss",
        seccion,
      })
    );
}

export async function ingestarTvn(fechaExtraccion: string, log: (s: string) => void) {
  const todas: Noticia[] = [];
  const consultas: { fuente: string; consulta: string; fecha: string; n: number }[] = [];
  for (const s of SECCIONES_TVN) {
    const url = `https://www.tvn-2.com/rss/${s}/`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 AgenteTVN" } });
    const xml = await r.text();
    const ns = r.ok ? parsearRssTvn(xml, s, fechaExtraccion) : [];
    log(`TVN /rss/${s}/ → ${r.status} · ${ns.length} ítems`);
    consultas.push({ fuente: "tvn_rss", consulta: url, fecha: fechaExtraccion, n: ns.length });
    todas.push(...ns);
  }
  return { noticias: todas, consultas };
}
