// Fuentes complementarias públicas (RSS de otros medios panameños): aportan corroboración independiente y réplicas de agencia.
import { parsearRssTvn } from "./tvn";
import type { Noticia } from "../motor/contrato";

export const OTROS_RSS: { medio: string; url: string }[] = [
  { medio: "prensa.com", url: "https://www.prensa.com/arc/outboundfeeds/rss/" },
  { medio: "panamaamerica.com.pa", url: "https://www.panamaamerica.com.pa/rss.xml" },
  { medio: "critica.com.pa", url: "https://www.critica.com.pa/rss.xml" },
];

export async function ingestarOtrosRss(fechaExtraccion: string, log: (s: string) => void) {
  const todas: Noticia[] = [];
  const consultas: { fuente: string; consulta: string; fecha: string; n: number }[] = [];
  for (const f of OTROS_RSS) {
    let ns: Noticia[] = [];
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 AgenteTVN" }, signal: AbortSignal.timeout(30000) });
      const xml = await r.text();
      ns = r.ok ? parsearRssTvn(xml, "rss", fechaExtraccion).map((n) => ({ ...n, medio: f.medio, origen: "rss_otros" as const, seccion: null })) : [];
    } catch (e) {
      log(`RSS ${f.medio} error: ${(e as Error).message.slice(0, 80)}`);
    }
    log(`RSS ${f.medio} → ${ns.length} ítems`);
    consultas.push({ fuente: "rss_otros", consulta: f.url, fecha: fechaExtraccion, n: ns.length });
    todas.push(...ns);
  }
  return { noticias: todas, consultas };
}
