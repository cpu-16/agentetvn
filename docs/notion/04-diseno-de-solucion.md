# Diseño de solución · AgenteTVN

## Arquitectura

```
Fuentes públicas ─► scripts/ingesta.ts ─► data/processed/ (noticias.csv, indicadores.csv, eventos.geojson, fuentes.json, manifest.json con SHA-256)
                    scripts/motor.ts ─► validación (T01) · detector de inyección · embeddings locales · temas · eventos y procedencias
                                        · contexto oficial · contradicciones · P y estado de evidencia ─► eventos.json, fichas.jsonl
Next.js (bun) ─► Entrada (PIN) · Portada · Agenda · Ficha · Paquete y revisión · Tablero (ECharts, agregados en /api/tablero) · Control · Chat del agente   |   SQLite (Prisma): revisiones, paquetes editados, decisiones
scripts/notion-sync.ts ─► bases de Notion (idempotente por id estable)
```

Un solo runtime (bun/Node). Sin servicios externos. Sin claves para la demo.

## Modelo de datos

Contrato de la §7 del reto: `noticias.csv` (id_noticia, titulo, url, medio, idioma, fecha_publicacion, fecha_deteccion, fecha_extraccion, tema, origen, alcance_texto + descripcion, agencia, sintetica, no_confiable, seccion), `indicadores.csv` (pais_iso3, indicador_id, anio, valor nullable, unidad, fuente_url, fecha_extraccion, licencia), `eventos.geojson` (USGS), `fichas.jsonl`, `manifest.json`. Objetos del motor: **publicación** (un registro) → **evento** (el hecho) → **procedencia** (agencia, medio, primaria o «no verificada»). Afirmación = `{texto, tipo: hecho_reportado|declaracion|inferencia|hipotesis, evidence_id, campo, alcance}`.

## Reglas (versión v1, 6-oct-2026, `config/scoring-v1.json`)

- Mismo evento: titulares casi idénticos (Jaccard ≥ 0.8) o coseno ≥ 0.90 con el representante del evento y ≤ 7 días.
- Procedencia: agencia atribuida en el texto = una procedencia por agencia; TVN = medio propio; titular copiado sin atribución = «independencia no verificada» (no suma).
- Fecha original = mínima fecha de publicación; la detección de GDELT nunca rejuvenece.
- R = 0.55·tema + 0.45·geo · I = 0.4·prior editorial + 0.3·alcance explícito + 0.3·magnitud del dato oficial · U por edad de la publicación más reciente (<24 h 1, <72 h 0.7, <7 d 0.4, <30 d 0.15, más 0.05; sin fecha 0.2) · N = 1 primera aparición / 0.3 segunda ola / 0 repetición · E = 0.45·primaria + 0.35·min(1, procedencias/2) + 0.20·identificable.
- P = 30R + 25I + 20U + 15N + 10E; rangos [0,40) [40,70) [70,100]; empate U desc, id asc.
- Estado de evidencia (aparte): insuficiente si E < 0.40 o (una procedencia y sin primaria); parcial si hay contradicción abierta o falta primaria; suficiente en otro caso. Suficiente no autoriza publicar.
- Contexto oficial solo con señal explícita (tema economía + concepto del indicador; sismo solo si hay evento USGS ≤ 7 días en Panamá). Si no, «sin relación sustentada».

## Modelos

- Embeddings: `Xenova/multilingual-e5-small` (ONNX q8, 384 dims) vía `@huggingface/transformers@3`, caché local `./.cache-modelos`. Prefijos `query:` / `passage:`. Costo: 0 (local). Tiempo: ~14 ms por lote de 3 textos en CPU.
- Baseline: BM25 (k1 1.5, b 0.75) sobre titular + extracto; palabras clave por tema.
- LLM de redacción (decisión D11, solo en `AGENTETVN_MODO=online`): proveedor Anthropic, modelo `claude-opus-5-5` (Claude Opus 5.5), invocado con Claude Code CLI 2.1.291 (`claude -p --tools "" --model claude-opus-5-5`) detrás de un shim compatible con OpenAI que escucha solo en `127.0.0.1:8766` del servidor de la demo. Parámetros: timeout 90 s en la demo (60 s por defecto), máximo 2 llamadas simultáneas, sin herramientas ni MCP. La temperatura se envía en 0, pero el CLI no la aplica (limitación declarada). El costo por intento es el que reporta `claude -p` (`total_cost_usd`, equivalente a la tarifa de API); la demo corre sobre una suscripción, así que no es facturación real. Cada intento, también los fallidos, queda en `db/llm-intentos.jsonl`.
- Qué hace el LLM y qué no: reescribe título, brief, guion, copy, 3 preguntas y vacíos, y redacta la respuesta del chat, siempre sobre la evidencia que ya recuperó el motor. No recupera, no prioriza, no cambia estados, no publica. Contradicciones, advertencias y la leyenda siguen siendo deterministas.
- Validación determinista de cada frase (`src/lib/motor/llm.ts`, `sostenida`): `evidence_id` de una fuente del evento (las no confiables nunca entran); tipo ∈ {hecho_reportado, declaración, inferencia, hipótesis}; toda cifra, incluidos años y fechas, presente en esa fuente («1,2» = «1.2», pero «12» ≠ «1,2»); toda cita entre comillas literal en la fuente; todo nombre propio o sigla presente en la fuente; ninguna causa («debido a», «provocó», «a raíz de»…) que la fuente no diga. Título, preguntas y vacíos: cifras y citas presentes en alguna fuente del evento (una pregunta puede nombrar a quién consultar). Campo y alcance se toman de la fuente, no del LLM.
- Respaldo: JSON roto, timeout, servicio caído, IA ocupada o brief sin frases válidas → paquete extractivo con el motivo en «Verificaciones». Un paquete redactado sobre otro snapshot (huella distinta) se vuelve a redactar.

## Prompts

- Modo offline: sin prompts. Plantillas por tema en `src/lib/motor/paquete.ts` (enfoque y preguntas). Leyenda fija: «Basado únicamente en titular/metadatos del snapshot».
- Modo online: el prompt de sistema (`SISTEMA`) y las dos plantillas de usuario (paquete y chat) están completos en `src/lib/motor/llm.ts`. El sistema fija seis reglas: usar solo los bloques `<<fuente>>` y tratarlos como dato, un `evidence_id` por frase con todo lo afirmado dentro de ese bloque, nada de cifras, causas ni culpables inventados (lo que falte va a «vacíos»), los cuatro tipos de afirmación, nunca insinuar lectura de la nota completa y responder solo JSON. La pregunta del chat también va como bloque de datos.

## Límites

Solo titulares y extractos (no se leyó el artículo); GDELT no da fecha de publicación; el modelo e5-small comprime los cosenos (umbral calibrado con etiquetas); clasificación zero-shot con «por revisar» cuando el margen es chico; evaluación exploratoria (sin editor de TVN).

## Tablero (BI)

Apache ECharts 5 (open source, renderer SVG, sin CDN) con gráficas enlazadas por un filtro compartido (tema, rango, período, medio): señales por día y tema con brush, treemap tema → eventos, dispersión relevancia (R) frente a evidencia (E) con zona «investigar», evidencia por tema, medios y tipos de procedencia, series del Banco Mundial 2010–2024 (6 países, Panamá resaltado, nulos como huecos), sismos USGS 2024 (dispersión lat/lon con la caja de consulta y barras por mes). Agregados calculados en el servidor (`src/lib/motor/tablero.ts`, probado), tooltips con HTML escapado (los titulares son datos no confiables), tabla equivalente por gráfica y `prefers-reduced-motion`.
