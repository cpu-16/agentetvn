# AgenteTVN — especificación (v1, 6-oct-2026)

**Problema (del reto, textual):** «Un equipo editorial debe revisar fuentes dispersas, eliminar duplicados, ubicar los hechos en contexto y preparar piezas con rapidez. La circulación de una noticia no equivale a su confirmación: varios medios pueden repetir una misma fuente.»

**Usuario:** editor/a de mesa de TVN Noticias al armar la agenda del día (mañana) y periodista que toma un tema para investigarlo. Modalidad: TVN editorial (sin banca).

**Resultado esperado:** la persona decide qué cinco temas investigar, ve qué afirmación está respaldada por cuál fuente, qué falta comprobar y recibe un borrador (brief, preguntas, guion, copy) que acepta, corrige o descarta. Nada se publica.

**Fuera de alcance:** rating/audiencia, detección de noticias falsas, datos personales, producción audiovisual, monitoreo continuo, modalidad bancaria.

## Entradas → salidas

| Entrada | Formato | Ejemplo |
|---|---|---|
| Noticias públicas (TVN RSS + GDELT DOC 2.0, últimos 90 días) | `data/processed/noticias.csv` (§7 del reto) | titular de TVN con fecha, URL, medio |
| Indicadores oficiales (Banco Mundial, 6 países × 6 indicadores, 2010–2024) | `indicadores.csv` con nulos conservados | PAN · FP.CPI.TOTL.ZG · 2024 · % |
| Sismos (USGS 2024, caja regional, M≥3) | `eventos.geojson` | id, magnitud, fecha, lugar |
| Consulta en español | texto | «¿Qué cinco temas merecen revisión para la agenda de Panamá?» |

| Salida | Formato | Ejemplo |
|---|---|---|
| Agenda priorizada | eventos ordenados por P con R/I/U/N/E y estado de evidencia | «Canal: 3 publicaciones · 1 procedencia (EFE) · P 72 · evidencia parcial» |
| Ficha de evidencia | afirmaciones tipadas con cita por afirmación | «hecho_reportado · TVN 2026-10-05 · campo: titulo» |
| Paquete editorial | título, enfoque, brief ≤250, 3 preguntas, verificaciones, guion 45–60 s, copy ≤80 | con leyenda «basado únicamente en titular/metadatos» |
| Revisión humana | estado + persona + motivo (SQLite) y registro en Notion | «requiere_evidencia · Gilberto · falta fuente primaria» |
| Abstención | respuesta sin cifras cuando no hay evidencia | «El snapshot no contiene la inflación de 2025…» |

## Reglas (deterministas, cada una con su evidencia)

R1 Mismo evento = titulares casi idénticos o similitud ≥ umbral con el representante y ≤7 días · R2 Agencia replicada = una sola procedencia; sin atribución = «independencia no verificada» · R3 Fecha original = mínima fecha de publicación; `seendate` nunca rejuvenece · R4 P = 30R+25I+20U+15N+10E con componentes 0–1 explicados; rangos [0,40) [40,70) [70,100]; empate U, luego id · R5 Estado de evidencia aparte de P · R6 Cifra de indicador siempre con país, año y unidad: «contexto histórico» · R7 Sin evidencia → abstención con lo que falta · R8 Texto de fuente = dato; patrones de instrucción → fuente no confiable, excluida · R9 Aprobar como borrador ≠ publicar.

## Papel de la IA

Embeddings locales (multilingual-e5-small) para agrupar eventos, clasificar temas y recuperar evidencia; baseline léxico (BM25 / palabras clave) comparado con las mismas consultas. Redacción extractiva desde afirmaciones validadas; un LLM (extra, modo online) solo propone enfoque y redacción con citas obligatorias que se validan contra IDs existentes. La IA nunca cambia estados, nunca publica, nunca inventa cifras.

## Aceptación

| Caso | Resultado esperado | Prueba |
|---|---|---|
| Archivo con fechas inválidas y nulos | carga lo válido, separa errores, conserva nulos | T01 |
| Tres registros del mismo evento | 1 evento, 3 publicaciones, 1 procedencia; P no se triplica | T02 |
| Noticia recirculada | muestra fecha original | T03 |
| Cifra anual del Banco Mundial | país, año, unidad; no «hoy» | T04 |
| Dos afirmaciones incompatibles | ambas visibles, verificación pendiente | T05 |
| Consulta sin respuesta | abstención explícita, 0 cifras | T06 |
| Fuente que exige ignorar instrucciones | no confiable, sin acciones | T07 |
| Prioridad alta | componentes visibles; no habilita publicar | T08 |
| Brief editorial | formato, citas, hechos vs. inferencias | T09 |
| Sin internet | funciona con snapshot y fallback declarado | T10 |

## Métrica de valor

Minutos para pasar de la bandeja a un tema con evidencia y brief, manual vs. asistido (2–3 tareas cronometradas, n declarado) · Precision@5 del ranking vs. selección a ciegas de una persona · cobertura de citas 100 % · abstención ≥80 % · macro-F1 de temas y P/R de agrupación sobre etiquetas humanas (n declarado).
