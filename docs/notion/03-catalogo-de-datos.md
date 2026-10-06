# Catálogo de datos · snapshot v1 (corte 2026-10-06T16:39:20.671Z)

| Fuente | URL | Extracción | Cobertura | Registros | Campos | Licencia / condiciones | Transformaciones | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| TVN Noticias · RSS público | https://www.tvn-2.com/rss/<seccion>/ | 2026-10-06T16:39:20.671Z | secciones con feed activo al corte; el RSS no conserva histórico | 135 descargados (13 consultas) | id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion | Solo titular, extracto corto, URL y fecha. El RSS público no implica licencia sobre artículos, imágenes ni videos; no se redistribuyen cuerpos. | ver abajo | `f2e51fe883b4c9cd…` |
| RSS públicos de Prensa, Panamá América y Crítica | ver manifest.consultas | 2026-10-06T16:39:20.671Z | últimos ítems del feed al corte (sin histórico) | 10 descargados (3 consultas) | id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion | Solo titular, extracto corto, URL y fecha; sin redistribución de contenido. Fuente complementaria para corroboración independiente (CU-03). | ver abajo | `f2e51fe883b4c9cd…` |
| GDELT DOC 2.0 API | https://api.gdeltproject.org/api/v2/doc/doc | 2026-10-06T16:39:20.671Z | últimos 90 días, consultas por tema, dedup por URL | 1500 descargados (15 consultas) | id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto, descripcion, agencia, sintetica, no_confiable, seccion | Metadatos (URL, titular, dominio, idioma, fecha de detección). GDELT no transfiere derechos de los medios enlazados. Límite: 1 consulta cada 5 s, 250 artículos por consulta. | ver abajo | `f2e51fe883b4c9cd…` |
| Banco Mundial · Indicators API v2 | https://api.worldbank.org/v2/ | 2026-10-06T16:39:20.671Z | 6 países × 6 indicadores × 15 años = 540 celdas (el PDF del reto dice 1.350; son 540) | 540 descargados (6 consultas) | pais_iso3, indicador_id, anio, valor (nullable), unidad, fuente_url, fecha_extraccion, licencia | CC BY 4.0 salvo excepciones por indicador en los metadatos. Datos revisables; el período de referencia no es la fecha de extracción. | ver abajo | `0d531e98c7491657…` |
| USGS · FDSN Event Web Service | https://earthquake.usgs.gov/fdsnws/event/1/ | 2026-10-06T16:39:20.671Z | 2024, lat 5–12, lon −86…−76, M≥3 (la caja no equivale al territorio de Panamá) | 82 descargados (1 consultas) | id, magnitude, time, updated, longitude, latitude, depth, place, status, url | Dominio público (gobierno de EE. UU.); confirmar elementos de terceros. Solo hechos sísmicos; nunca evidencia de inundación o pérdidas. | ver abajo | `4f100d86d72ceab6…` |

## Cantidades finales

- noticias.csv: 1071
- noticias_tvn: 85
- indicadores.csv: 540
- indicadores_con_valor: 540
- eventos.geojson: 82

## Transformaciones

- URLs normalizadas (host minúsculas, sin www, sin utm_*/fbclid/gclid, sin fragmento ni barra final) y deduplicadas conservando la primera aparición
- fecha_publicacion = pubDate del RSS (ISO UTC); GDELT solo aporta fecha_deteccion (seendate) y deja fecha_publicacion nula
- ventana de noticias: 90 días previos al corte y nunca posteriores al corte (§6 del reto); la ventana [2024-01-01, 2025-10-01) de la §7 no se aplica a noticias porque contradice la §6 y la fecha de consulta; política configurable en scripts/ingesta.ts
- indicadores: grilla completa país × indicador × año con valor nulo cuando el Banco Mundial no publica; nunca 0 por ausencia
- agencia detectada por patrones (config/agencias.json) sobre titular + descripción
- excluidas 490 noticias duplicadas por URL, 51 fuera de ventana y 33 registros cuyo titular es la portada de un sitio o tiene menos de 4 palabras (no son noticias)

## Discrepancias del PDF del reto

- §6: 6 países × 6 indicadores × 15 años = 540 combinaciones, no 1.350
- §7: intervalo [2024-01-01, 2025-10-01) incompatible con «30–90 días previos» de la §6 y con la fecha de consulta 5-oct-2026; se aplica la §6 por familia

## SHA-256 completos

- noticias.csv: `f2e51fe883b4c9cd53cf243c52f50673df28a107dc83012e28aa94467ab918e1`
- indicadores.csv: `0d531e98c74916574ed924a93365d52081646fa4b76744dde39e515b6e96a06c`
- eventos.geojson: `4f100d86d72ceab6c986141dac2d58de0fb55e1a5c4f1df818b73e25d4645fc4`
- fuentes.json: `28ccf5d1494a2fe1b5b8870896cc5aa9b4ddea204e9585c1e363fd0f158c9a99`

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
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260921150000&enddatetime=20261006150000 (caché)
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260906150000&enddatetime=20260921150000 (caché)
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260822150000&enddatetime=20260906150000 (caché)
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260723150000&enddatetime=20260807150000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20domain%3Atvn-2.com&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708150000&enddatetime=20260807150000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20turismo%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708150000&enddatetime=20261006150000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20econom%C3%ADa%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708150000&enddatetime=20261006150000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sismo%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708150000&enddatetime=20261006150000 (caché)
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260921160000&enddatetime=20261006160000 (caché)
- gdelt · 250 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260822160000&enddatetime=20260906160000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20domain%3Atvn-2.com&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260906160000&enddatetime=20261006160000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20domain%3Atvn-2.com&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708160000&enddatetime=20260807160000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=%22Canal%20de%20Panam%C3%A1%22%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708160000&enddatetime=20261006160000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20turismo%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708160000&enddatetime=20261006160000 (caché)
- gdelt · 0 · https://api.gdeltproject.org/api/v2/doc/doc?query=Panama%20sismo%20sourcelang%3Aspanish&mode=artlist&maxrecords=250&format=json&sort=datedesc&startdatetime=20260708160000&enddatetime=20261006160000 (caché)
- rss_otros · 0 · https://www.prensa.com/arc/outboundfeeds/rss/
- rss_otros · 0 · https://www.panamaamerica.com.pa/rss.xml
- rss_otros · 10 · https://www.critica.com.pa/rss.xml
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/NY.GDP.MKTP.KD.ZG?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/FP.CPI.TOTL.ZG?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/SL.UEM.TOTL.ZS?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/SP.POP.TOTL?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/IT.NET.USER.ZS?date=2010:2024&format=json&per_page=200
- bancomundial · 90 · https://api.worldbank.org/v2/country/PAN;CRI;COL;DOM;MEX;GTM/indicator/NE.EXP.GNFS.ZS?date=2010:2024&format=json&per_page=200
- usgs · 82 · https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2025-01-01&minlatitude=5&maxlatitude=12&minlongitude=-86&maxlongitude=-76&minmagnitude=3&orderby=time
