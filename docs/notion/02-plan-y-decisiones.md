# Plan y decisiones · AgenteTVN (registro durante la ejecución)

Equipo ciberpty: Jeffery Gyamerah (documentación, Notion, difusión, revisión editorial) · Gilberto Valdés (construcción). Hora de Panamá (UTC−5).

## Decisiones

| ID | Fecha y hora | Decisión | Alternativa descartada | Motivo | Responsable |
|---|---|---|---|---|---|
| D1 | 2026-10-06 10:50 | Modalidad TVN editorial, sin modalidad bancaria. | Hacer ambas. | El reto no exige dos productos; 1.5 días efectivos. | Gilberto |
| D2 | 2026-10-06 10:50 | App web de 4 vistas sobre Next.js + shadcn + Prisma/SQLite (arnés del reto clasificatorio), con embeddings locales en Node (transformers.js, multilingual-e5-small) y BM25 como baseline y fallback. | Python (FastAPI) + HTML; notebook. | Un solo runtime para el jurado (`bun install && bun run demo`), demo offline, revisión humana persistente. Spike de embeddings en Node probado a las 10:45. | Gilberto |
| D3 | 2026-10-06 11:30 | Ventanas por familia de datos: noticias = 90 días previos al corte; indicadores 2010–2024 (540 celdas, no 1 350); sismos 2024. | Aplicar el intervalo [2024-01-01, 2025-10-01) de la §7 a todo. | La §7 contradice la §6 y la fecha de consulta del PDF (5-oct-2026). Se registra como discrepancia en el manifest. | Gilberto |
| D4 | 2026-10-06 12:40 | Redacción extractiva por plantillas desde afirmaciones citadas; LLM solo como extra en modo online. | Generar brief con LLM desde el inicio. | T10 (sin internet) y anti-alucinación: sin LLM no hay cifra inventada posible. | Gilberto |
| D5 | 2026-10-06 13:10 | Umbral de «mismo evento» 0.90 (no 0.82). | 0.82 inicial. | El p90 de cosenos entre noticias no relacionadas de TVN fue 0.832: con 0.82 se mezclaban eventos distintos (42 eventos de 85 noticias). Con 0.90 quedan 75 y se agrupan solo duplicados reales. | Gilberto |
| D6 | 2026-10-06 13:10 | Impacto = 0.4·prior editorial del tema + 0.3·alcance explícito + 0.3·magnitud del dato oficial; clase «deportes» y «otro» fuera de la agenda. | Impacto solo por tema. | La sección economía del RSS de TVN trae lanzamientos de marcas que dominaban el top 5. | Gilberto |

## Tareas (backlog)

| # | Tarea | Responsable | Estado | Fecha |
|---|---|---|---|---|
| T-01 | Pedir en WhatsApp el snapshot común y el acceso a Notion Business | Jeff | pendiente | 6-oct |
| T-02 | Snapshot propio: TVN RSS + GDELT + Banco Mundial + USGS con manifest SHA-256 | Gilberto | en curso (GDELT con límite 429) | 6-oct |
| T-03 | Motor: embeddings, temas, eventos/procedencias, P, evidencia, contradicciones, inyección | Gilberto | hecho | 6-oct 13:10 |
| T-04 | Consulta en español con abstención (T06) y paquete editorial (T09) | Gilberto | hecho | 6-oct 13:40 |
| T-05 | API + revisión humana persistente | Gilberto | hecho | 6-oct 14:00 |
| T-06 | UI: Agenda, Ficha, Paquete y revisión, Control | Gilberto | en curso | 6-oct |
| T-07 | Etiquetado humano: 100 titulares (tema) + 60 pares (mismo evento) + 5 temas a ciegas | Jeff + Gilberto | pendiente | 6-oct noche |
| T-08 | Benchmark de 60 consultas (40 dev / 20 reservadas) y métricas vs baseline | Gilberto | pendiente | 7-oct |
| T-09 | Pruebas T01–T10 en la matriz con evidencia y correcciones | Gilberto | 8/10 automatizadas | 7-oct |
| T-10 | Notion: 8 páginas (catálogo, casos, pruebas, riesgos, presentación) | Jeff | pendiente (sin licencia aún; se registra en Markdown) | 6–7-oct |
| T-11 | Demo offline en máquina limpia + README para jueces | Gilberto | pendiente | 7-oct |
| T-12 | Posts diarios en LinkedIn con las etiquetas oficiales | Jeff | pendiente | 6, 7, 8-oct |

| D7 | 2026-10-06 12:20 | Revisión externa de correctitud del motor (Codex, `docs/CODEX-REVISION-MOTOR.md`, 16 hallazgos) y corrección en `aa3795f`: fuentes no confiables fuera del título/copy del paquete, una copia de TVN no suma corroboración, la urgencia usa la fecha original (una réplica no rejuvenece), abstención ante año/país no soportado y causalidad, contradicciones con campo, validación estricta de fechas, USGS tolerante, huella de derivados. | Confiar solo en las pruebas T01–T10 propias. | Las pruebas pasaban sin probar la cadena completa (p. ej. T07 no recorría CSV → motor → paquete). **Esta es la «prueba fallida y su corrección» para el jurado.** | Gilberto |
| D8 | 2026-10-06 12:40 | Fusión semántica de eventos exige además solapamiento léxico (Jaccard ≥ 0.2); los casos sintéticos nunca se mezclan con noticias reales; «deportes» por vocabulario aunque no venga de la sección. | Coseno solo. | Con el corpus de 1 084 noticias, «Panamá + acuerdo» de temas distintos se fusionaba (12 publicaciones mezcladas, incluidas réplicas sintéticas). | Gilberto |
| D9 | 2026-10-06 12:45 | CU-01 («cinco temas») con diversidad: máximo dos eventos por tema; se excluyen deportes, otro y sintéticos. Títulos que son portada de un sitio o tienen menos de 4 palabras se excluyen en la ingesta y se cuentan en el manifest. | Top 5 crudo por P. | Una agenda de cinco temas iguales no sirve al editor; «Inicio \| Periódico X» no es una noticia. | Gilberto |
