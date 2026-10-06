# Tablero · especificación para Codex (construcción) y Cursor (revisión)

Repo: este worktree (`feat/tablero`, base `main`). App Next.js 16 + React 19 + shadcn + framer-motion, un solo runtime (bun), demo sin internet (nada de CDN: ECharts ya está instalado por npm, `echarts@5`). Español de Panamá en toda la UI. No tocar `src/lib/motor/**`, `scripts/**`, `tests/**`, `data/**` salvo lo indicado.

## Qué es
Nueva vista **Tablero** en la navegación (Portada / Agenda / **Tablero** / Control), tipo BI: gráficas interactivas **enlazadas** (un filtro en una gráfica filtra las demás) que explican visualmente la bandeja: de dónde vienen las señales, cómo se reparten por tema y evidencia, qué dicen los datos oficiales y dónde ocurrieron los sismos. Es para el editor y para el jurado (rúbrica: utilidad 20, evidencias/explicabilidad 15, calidad técnica 10).

## Datos (servidor)
Crear `GET /api/tablero` en `src/app/api/tablero/route.ts` usando `cargarSnapshot()` de `src/lib/motor/cargar.ts` (ya exporta `Snapshot` con `noticias`, `indicadores`, `sismos`, `eventos`, `manifest`). Devuelve agregados listos para graficar (nunca el snapshot entero):

```ts
{
  corteUTC: string; version: string;
  eventos: { id: string; titulo: string; tema: string; P: number; rango: "bajo"|"medio"|"alto"; R: number; I: number; U: number; N: number; E: number;
             estado_evidencia: string; publicaciones: number; procedencias: number; fecha: string | null; medio: string; sintetica: boolean; no_confiable: boolean }[]; // uno por evento, sin explicaciones largas
  porDiaTema: { dia: string /* YYYY-MM-DD hora Panamá */; tema: string; n: number }[];       // publicaciones por día y tema (fecha_publicacion ?? fecha_deteccion)
  medios: { medio: string; publicaciones: number; eventos: number; agencia: boolean }[];     // top 25 por publicaciones
  procedencias: { tipo: "agencia"|"medio"|"primaria"|"no_verificada"; n: number }[];
  temas: { tema: string; nombre: string; eventos: number; publicaciones: number; P_mediana: number; por_revisar: number }[];
  evidencia: { tema: string; insuficiente: number; parcial: number; suficiente: number }[];
  indicadores: { indicador_id: string; nombre: string; unidad: string; series: { pais: string; puntos: [number /*año*/, number | null][] }[] }[]; // 6 indicadores × 6 países, 2010–2024, nulos como null
  sismos: { id: string; lat: number; lon: number; mag: number; depth: number; time: string; place: string; url: string }[];
  sismosPorMes: { mes: string; n: number; magMax: number }[];
  calidad: { noticias: number; tvn: number; sinFechaPublicacion: number; sinteticas: number; noConfiables: number; errores: number };
}
```
Nombres de tema: usar `leerTemas()` de `src/lib/motor/config.ts` (`id` → `nombre`). Los nombres de indicador y unidad están en `INDICADORES` de `src/lib/ingesta/bancomundial.ts`.

## Vista (cliente)
`src/components/mesa/tablero.tsx` + `src/components/mesa/graficas/*.tsx` (una gráfica por archivo, un wrapper `Grafica.tsx` que monta `echarts` con `import * as echarts from "echarts/core"` y registra solo los charts/componentes usados: BarChart, LineChart, ScatterChart, TreemapChart, HeatmapChart, BoxplotChart, Grid, Tooltip, Legend, DataZoom, Brush, VisualMap, Title, Dataset, Transform; renderer SVG para nitidez y accesibilidad), con `ResizeObserver`, `aria-label` y una tabla equivalente oculta/plegable («Ver como tabla») por gráfica para lectores de pantalla.

Estado compartido del tablero (zustand o useState en `tablero.tsx`): `filtro = { temas: string[]; rango: ("bajo"|"medio"|"alto")[]; desde?: string; hasta?: string; medio?: string }`. Toda gráfica lee `filtro` y lo modifica al interactuar (clic en treemap → tema; brush en la línea de tiempo → desde/hasta; clic en barra de medio → medio; leyenda → rango). Barra de filtros activos arriba con chips y «Limpiar». La agenda puede recibir el filtro: un botón «Ver estos N temas en la agenda» que navega a la agenda con el mismo filtro de tema (añade `filtroTablero` al store de `src/store/mesa.ts` y que `agenda.tsx` lo respete si existe; cambio mínimo).

Gráficas (en este orden, grid de 2 columnas en escritorio, 1 en 390 px):
1. **Cifras del corte** (4 tarjetas): publicaciones, eventos, medios y agencias distintos, eventos con evidencia suficiente. Con `filtro` aplicado.
2. **Señales por día y tema** — área apilada por tema con `dataZoom` + `brush` horizontal que fija `desde/hasta`. Eje x en hora Panamá.
3. **Mapa de temas** — treemap tema → eventos (tamaño = publicaciones, color = P mediana con `visualMap` azul claro → azul TVN; «por revisar» con trama). Clic en tema filtra; clic en evento abre la ficha (`useMesa().irA("ficha", id)` o como lo haga `agenda.tsx`).
4. **Relevancia frente a evidencia** — dispersión R (x) vs E (y), tamaño = publicaciones, color = rango (bajo gris, medio azul claro, alto azul TVN; rojo solo cuando `estado_evidencia === "insuficiente"` y rango alto: los que hay que investigar). Tooltip con titular; clic abre la ficha. Líneas de referencia en R 0.5 y E 0.4 con rótulos «investigar» / «listo para borrador».
5. **Estado de evidencia por tema** — barras apiladas 100 % (insuficiente rojo, parcial ámbar, suficiente verde).
6. **Medios y procedencias** — barras horizontales top 15 medios (publicaciones) con marca de agencia; al lado, dona pequeña de tipos de procedencia (agencia / medio / primaria / no verificada).
7. **Contexto oficial (Banco Mundial)** — selector de indicador (6) y líneas 2010–2024 de los 6 países, Panamá resaltado en azul TVN y los demás en gris; nulos como huecos; tooltip con valor, unidad y año; nota fija «Dato anual, contexto histórico: no es una medición de hoy».
8. **Sismos USGS 2024** — dispersión geográfica lat/lon (sin mapa base: ejes con la caja lat 5–12, lon −86…−76, línea punteada del rectángulo y rótulo «la caja no equivale al territorio de Panamá»), tamaño = magnitud, color = profundidad; junto, barras por mes con magnitud máxima. Tooltip con lugar, fecha, magnitud y enlace al evento USGS (solo http/https).
9. **Calidad del snapshot** — mini tarjetas: sin fecha de publicación, sintéticos, no confiables, errores separados (T01).

## Diseño
Tokens de `src/app/globals.css` (azul TVN #00466f / #0077c8, papel #F3F5F8, rojo #D7263D solo alertas, ámbar #E0A100, verde #1B9E77, tipografía IBM Plex). Paleta categórica de temas: 8 tonos legibles entre sí, consistentes en todas las gráficas (definir una vez en `graficas/paleta.ts`). Tooltips en español con numerales tabulares. Animación de entrada de ECharts corta (300 ms) y desactivada con `prefers-reduced-motion`. Nada de eyebrows en mayúsculas ni «·» entre metadatos.

## Calidad
`bun run lint` sin errores, `bun run build`, `bun test` en verde (no toques pruebas existentes; añade `tests/api-tablero.test.ts` que llame a la función de agregación con un snapshot de prueba y compruebe que `porDiaTema` suma las publicaciones y que `indicadores` conserva nulos). Verifica con `next start` + Playwright capturas 1440 y 390 de la vista completa y de cada interacción (brush, clic en treemap, cambio de indicador) en `docs/capturas/tablero/`; sin scroll horizontal. Commits chicos en español con `Co-Authored-By`.
