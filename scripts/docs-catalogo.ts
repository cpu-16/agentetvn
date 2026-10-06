// Genera docs/notion/03-catalogo-de-datos.md desde manifest.json y fuentes.json (para pegar en Notion).
import { readFileSync, writeFileSync } from "fs";
const m = JSON.parse(readFileSync("data/processed/manifest.json", "utf8"));
const f = JSON.parse(readFileSync("data/processed/fuentes.json", "utf8")) as Record<string, { nombre: string; url: string; condiciones: string; cobertura: string }>;
const archivo: Record<string, string> = { tvn_rss: "noticias.csv", rss_otros: "noticias.csv", gdelt: "noticias.csv", bancomundial: "indicadores.csv", usgs: "eventos.geojson" };
const porFuente = (k: string) => m.consultas.filter((c: { fuente: string }) => c.fuente === k);
let md = `# Catálogo de datos · snapshot ${m.version} (corte ${m.fecha_corte_UTC})\n\n| Fuente | URL | Extracción | Cobertura | Registros | Campos | Licencia / condiciones | Transformaciones | SHA-256 |\n|---|---|---|---|---|---|---|---|---|\n`;
const campos: Record<string, string> = { "noticias.csv": "id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion", "indicadores.csv": "pais_iso3, indicador_id, anio, valor (nullable), unidad, fuente_url, fecha_extraccion, licencia", "eventos.geojson": "id, magnitude, time, updated, longitude, latitude, depth, place, status, url" };
for (const [k, v] of Object.entries(f)) {
  const n = porFuente(k).reduce((s: number, c: { n: number }) => s + (c.n ?? 0), 0);
  md += `| ${v.nombre} | ${v.url} | ${m.fecha_corte_UTC} | ${v.cobertura} | ${n} descargados (${porFuente(k).length} consultas) | ${campos[archivo[k]]} | ${v.condiciones} | ver abajo | \`${(m.sha256[archivo[k]] ?? "").slice(0, 16)}…\` |\n`;
}
md += `\n## Cantidades finales\n\n${Object.entries(m.cantidades).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n## Transformaciones\n\n${m.transformaciones.map((t: string) => `- ${t}`).join("\n")}\n\n## Discrepancias del PDF del reto\n\n${m.discrepancias_pdf.map((t: string) => `- ${t}`).join("\n")}\n\n## SHA-256 completos\n\n${Object.entries(m.sha256).map(([k, v]) => `- ${k}: \`${v}\``).join("\n")}\n\n## Consultas ejecutadas\n\n${m.consultas.map((c: { fuente: string; consulta: string; n: number }) => `- ${c.fuente} · ${c.n} · ${c.consulta}`).join("\n")}\n`;
writeFileSync("docs/notion/03-catalogo-de-datos.md", md);
console.log("docs/notion/03-catalogo-de-datos.md");
