// ─────────────────────────────────────────────────────────────
// ingesta · arma el snapshot «Panamá · Señales y Evidencias v1»
//   bun run ingesta            (descarga TVN RSS, GDELT, Banco Mundial, USGS)
//   bun run ingesta --sin-gdelt   (solo lo rápido; útil para probar)
// Sale 2 si no se alcanza el mínimo del reto (100 noticias únicas, 20 de TVN).
// ─────────────────────────────────────────────────────────────
import { mkdirSync, existsSync } from "fs";
import { dedup } from "../src/lib/ingesta/comun";
import { ingestarTvn } from "../src/lib/ingesta/tvn";
import { ingestarGdelt } from "../src/lib/ingesta/gdelt";
import { ingestarOtrosRss } from "../src/lib/ingesta/otros_rss";
import { ingestarBancoMundial, INDICADORES, PAISES, ANIOS } from "../src/lib/ingesta/bancomundial";
import { ingestarUsgs } from "../src/lib/ingesta/usgs";
import { COLUMNAS_INDICADORES, COLUMNAS_NOTICIAS, escribirCsv, escribirJson, hashArchivo } from "../src/lib/ingesta/escribir";
import type { Manifest, Noticia } from "../src/lib/motor/contrato";

const sinGdelt = process.argv.includes("--sin-gdelt");
const corte = new Date();
const fechaExtraccion = corte.toISOString();
const dia = fechaExtraccion.slice(0, 10);
const RAW = `data/raw`;
const OUT = `data/processed`;
mkdirSync(`${RAW}/${dia}`, { recursive: true });
mkdirSync(OUT, { recursive: true });
const log = (s: string) => console.log(`[ingesta] ${s}`);
const consultas: Manifest["consultas"] = [];

// A · noticias
const tvn = await ingestarTvn(fechaExtraccion, log);
escribirJson(`${RAW}/${dia}/tvn_rss.json`, tvn.noticias);
consultas.push(...tvn.consultas);
let gdeltNoticias: Noticia[] = [];
if (!sinGdelt) {
  const corteHora = new Date(Math.floor(corte.getTime() / 3600000) * 3600000); // ventanas estables dentro de la misma hora → la caché por URL sirve
  const g = await ingestarGdelt(corteHora, fechaExtraccion, log);
  escribirJson(`${RAW}/${dia}/gdelt.json`, g.noticias);
  consultas.push(...g.consultas);
  gdeltNoticias = g.noticias;
}
const limite = new Date(corte.getTime() - 90 * 86400000).toISOString();
const enVentana = (n: Noticia) => {
  const f = n.fecha_publicacion ?? n.fecha_deteccion;
  return !f || f >= limite;
};
const otros = await ingestarOtrosRss(fechaExtraccion, log);
escribirJson(`${RAW}/${dia}/otros_rss.json`, otros.noticias);
consultas.push(...otros.consultas);
const { unicas, excluidas } = dedup([...tvn.noticias, ...gdeltNoticias, ...otros.noticias].filter(enVentana));
const fueraVentana = tvn.noticias.length + gdeltNoticias.length + otros.noticias.length - excluidas - unicas.length;
const deTvn = unicas.filter((n) => n.medio === "TVN").length;
log(`noticias únicas: ${unicas.length} (TVN ${deTvn}) · duplicadas por URL: ${excluidas} · fuera de 90 días: ${fueraVentana}`);
escribirCsv(`${OUT}/noticias.csv`, unicas as unknown as Record<string, unknown>[], COLUMNAS_NOTICIAS);

// B · indicadores
const bm = await ingestarBancoMundial(fechaExtraccion, log);
escribirJson(`${RAW}/${dia}/bancomundial.json`, bm.crudo);
consultas.push(...bm.consultas);
escribirCsv(`${OUT}/indicadores.csv`, bm.indicadores as unknown as Record<string, unknown>[], COLUMNAS_INDICADORES);

// C · sismos
const usgs = await ingestarUsgs(fechaExtraccion, log);
escribirJson(`${RAW}/${dia}/usgs.geojson`, usgs.geojson);
escribirJson(`${OUT}/eventos.geojson`, usgs.geojson);
consultas.push(...usgs.consultas);

// fuentes.json · condiciones por fuente
escribirJson(`${OUT}/fuentes.json`, {
  tvn_rss: { nombre: "TVN Noticias · RSS público", url: "https://www.tvn-2.com/rss/<seccion>/", condiciones: "Solo titular, extracto corto, URL y fecha. El RSS público no implica licencia sobre artículos, imágenes ni videos; no se redistribuyen cuerpos.", cobertura: "secciones con feed activo al corte; el RSS no conserva histórico" },
  rss_otros: { nombre: "RSS públicos de Prensa, Panamá América y Crítica", url: "ver manifest.consultas", condiciones: "Solo titular, extracto corto, URL y fecha; sin redistribución de contenido. Fuente complementaria para corroboración independiente (CU-03).", cobertura: "últimos ítems del feed al corte (sin histórico)" },
  gdelt: { nombre: "GDELT DOC 2.0 API", url: "https://api.gdeltproject.org/api/v2/doc/doc", condiciones: "Metadatos (URL, titular, dominio, idioma, fecha de detección). GDELT no transfiere derechos de los medios enlazados. Límite: 1 consulta cada 5 s, 250 artículos por consulta.", cobertura: "últimos 90 días, consultas por tema, dedup por URL" },
  bancomundial: { nombre: "Banco Mundial · Indicators API v2", url: "https://api.worldbank.org/v2/", condiciones: "CC BY 4.0 salvo excepciones por indicador en los metadatos. Datos revisables; el período de referencia no es la fecha de extracción.", cobertura: `${PAISES.length} países × ${Object.keys(INDICADORES).length} indicadores × ${ANIOS.length} años = ${PAISES.length * Object.keys(INDICADORES).length * ANIOS.length} celdas (el PDF del reto dice 1.350; son 540)` },
  usgs: { nombre: "USGS · FDSN Event Web Service", url: "https://earthquake.usgs.gov/fdsnws/event/1/", condiciones: "Dominio público (gobierno de EE. UU.); confirmar elementos de terceros. Solo hechos sísmicos; nunca evidencia de inundación o pérdidas.", cobertura: "2024, lat 5–12, lon −86…−76, M≥3 (la caja no equivale al territorio de Panamá)" },
});

// manifest
const archivos = ["noticias.csv", "indicadores.csv", "eventos.geojson", "fuentes.json"];
const manifest: Manifest = {
  version: "v1",
  fecha_corte_UTC: fechaExtraccion,
  consultas,
  cantidades: { "noticias.csv": unicas.length, "noticias_tvn": deTvn, "indicadores.csv": bm.indicadores.length, "indicadores_con_valor": bm.indicadores.filter((i) => i.valor !== null).length, "eventos.geojson": usgs.sismos.length },
  licencias: { tvn_rss: "metadatos; sin redistribución de contenido", rss_otros: "metadatos; sin redistribución de contenido", gdelt: "metadatos; sin derechos sobre medios", bancomundial: "CC BY 4.0", usgs: "dominio público" },
  sha256: Object.fromEntries(archivos.map((a) => [a, hashArchivo(`${OUT}/${a}`)])),
  transformaciones: [
    "URLs normalizadas (host minúsculas, sin www, sin utm_*/fbclid/gclid, sin fragmento ni barra final) y deduplicadas conservando la primera aparición",
    "fecha_publicacion = pubDate del RSS (ISO UTC); GDELT solo aporta fecha_deteccion (seendate) y deja fecha_publicacion nula",
    "ventana de noticias: 90 días previos al corte (§6 del reto); la ventana [2024-01-01, 2025-10-01) de la §7 no se aplica a noticias porque contradice la §6 y la fecha de consulta",
    "indicadores: grilla completa país × indicador × año con valor nulo cuando el Banco Mundial no publica; nunca 0 por ausencia",
    "agencia detectada por patrones (config/agencias.json) sobre titular + descripción",
    `excluidas ${excluidas} noticias duplicadas por URL y ${fueraVentana} fuera de ventana`,
  ],
  discrepancias_pdf: ["§6: 6 países × 6 indicadores × 15 años = 540 combinaciones, no 1.350", "§7: intervalo [2024-01-01, 2025-10-01) incompatible con «30–90 días previos» de la §6 y con la fecha de consulta 5-oct-2026; se aplica la §6 por familia"],
};
escribirJson(`${OUT}/manifest.json`, manifest);
log(`manifest escrito · corte ${fechaExtraccion}`);

if (unicas.length < 100 || deTvn < 20) {
  console.error(`[ingesta] DÉFICIT: ${unicas.length} noticias únicas (mínimo 100), ${deTvn} de TVN (mínimo 20). Documentar y escalar a la organización.`);
  process.exit(2);
}
void existsSync;
