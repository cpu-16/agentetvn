# Catálogo de datos · snapshot v1 (corte 2026-10-06T15:19:35.959Z)

| Fuente | URL | Extracción | Cobertura | Registros | Campos | Licencia / condiciones | Transformaciones | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| TVN Noticias · RSS público | https://www.tvn-2.com/rss/<seccion>/ | 2026-10-06T15:19:35.959Z | secciones con feed activo al corte; el RSS no conserva histórico | 135 descargados (13 consultas) | id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion | Solo titular, extracto corto, URL y fecha. El RSS público no implica licencia sobre artículos, imágenes ni videos; no se redistribuyen cuerpos. | ver abajo | `2ae5049c02c20aad…` |
| GDELT DOC 2.0 API | https://api.gdeltproject.org/api/v2/doc/doc | 2026-10-06T15:19:35.959Z | últimos 90 días, consultas por tema, dedup por URL | 0 descargados (0 consultas) | id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion | Metadatos (URL, titular, dominio, idioma, fecha de detección). GDELT no transfiere derechos de los medios enlazados. Límite: 1 consulta cada 5 s, 250 artículos por consulta. | ver abajo | `2ae5049c02c20aad…` |
| Banco Mundial · Indicators API v2 | https://api.worldbank.org/v2/ | 2026-10-06T15:19:35.959Z | 6 países × 6 indicadores × 15 años = 540 celdas (el PDF del reto dice 1.350; son 540) | 540 descargados (6 consultas) | pais_iso3, indicador_id, anio, valor (nullable), unidad, fuente_url, fecha_extraccion, licencia | CC BY 4.0 salvo excepciones por indicador en los metadatos. Datos revisables; el período de referencia no es la fecha de extracción. | ver abajo | `9ad896aa1f1d373d…` |
| USGS · FDSN Event Web Service | https://earthquake.usgs.gov/fdsnws/event/1/ | 2026-10-06T15:19:35.959Z | 2024, lat 5–12, lon −86…−76, M≥3 (la caja no equivale al territorio de Panamá) | 82 descargados (1 consultas) | id, magnitude, time, updated, longitude, latitude, depth, place, status, url | Dominio público (gobierno de EE. UU.); confirmar elementos de terceros. Solo hechos sísmicos; nunca evidencia de inundación o pérdidas. | ver abajo | `3fc4d8812fa084b6…` |

## Cantidades finales

- noticias.csv: 85
- noticias_tvn: 85
- indicadores.csv: 540
- indicadores_con_valor: 540
- eventos.geojson: 82

## Transformaciones

- URLs normalizadas (host minúsculas, sin www, sin utm_*/fbclid/gclid, sin fragmento ni barra final) y deduplicadas conservando la primera aparición
- fecha_publicacion = pubDate del RSS (ISO UTC); GDELT solo aporta fecha_deteccion (seendate) y deja fecha_publicacion nula
- ventana de noticias: 90 días previos al corte (§6 del reto); la ventana [2024-01-01, 2025-10-01) de la §7 no se aplica a noticias porque contradice la §6 y la fecha de consulta
- indicadores: grilla completa país × indicador × año con valor nulo cuando el Banco Mundial no publica; nunca 0 por ausencia
- agencia detectada por patrones (config/agencias.json) sobre titular + descripción
- excluidas 0 noticias duplicadas por URL y 50 fuera de ventana

## Discrepancias del PDF del reto

- §6: 6 países × 6 indicadores × 15 años = 540 combinaciones, no 1.350
- §7: intervalo [2024-01-01, 2025-10-01) incompatible con «30–90 días previos» de la §6 y con la fecha de consulta 5-oct-2026; se aplica la §6 por familia

## SHA-256 completos

- noticias.csv: `2ae5049c02c20aadfc1c4720a99befd9e84efe054a056ac338722f03d61697c4`
- indicadores.csv: `9ad896aa1f1d373d16f10b2013084351fe8a4e5cd7479b64bd22cbd51969818f`
- eventos.geojson: `3fc4d8812fa084b61b5eb485e0385527b58b7d8cef243b37dce77c4a2cfbb34a`
- fuentes.json: `6172c64ece0d27a60d770691ecfea7b8a5b0aa13053d4a01093e34771115de86`

## Consultas ejecutadas

- tvn_rss · 14 · https://www.tvn-2.com/rss/nacionales/
- tvn_rss · 50 · https://www.tvn-2.com/rss/economia/
- tvn_rss · 0 · https://www.tvn-2.com/rss/politica/
- tvn_rss · 0 · https://www.tvn-2.com/rss/provincias/
- tvn_rss · 0 · https://www.tvn-2.com/rss/salud/
- tvn_rss · 50 · https://www.tvn-2.com/rss/tecnologia/
- tvn_rss · 21 · https://www.tvn-2.com/rss/deportes/
- tvn_rss · 0 · https://www.tvn-2.com/rss/mundo/
- tvn_rss · 0 · https://www.tvn-2.com/rss/internacionales/
- tvn_rss · 0 · https://www.tvn-2.com/rss/judicial/
- tvn_rss · 0 · https://www.tvn-2.com/rss/seguridad/
- tvn_rss · 0 · https://www.tvn-2.com/rss/sociedad/
- tvn_rss · 0 · https://www.tvn-2.com/rss/clima/
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/NY.GDP.MKTP.KD.ZG?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/FP.CPI.TOTL.ZG?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/SL.UEM.TOTL.ZS?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/SP.POP.TOTL?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/IT.NET.USER.ZS?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/NE.EXP.GNFS.ZS?date=2010:2024&format=json&per_page=200
- usgs · 82 · https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2025-01-01&minlatitude=5&maxlatitude=12&minlongitude=-86&maxlongitude=-76&minmagnitude=3&orderby=time
