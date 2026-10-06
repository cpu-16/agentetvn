# Diseño de solución · AgenteTVN

## Arquitectura

```
Fuentes públicas ─► scripts/ingesta.ts ─► data/processed/ (noticias.csv, indicadores.csv, eventos.geojson, fuentes.json, manifest.json con SHA-256)
                    scripts/motor.ts ─► validación (T01) · detector de inyección · embeddings locales · temas · eventos y procedencias
                                        · contexto oficial · contradicciones · P y estado de evidencia ─► eventos.json, fichas.jsonl
Next.js (bun) ─► Agenda · Ficha · Paquete y revisión · Control   |   SQLite (Prisma): revisiones, paquetes editados, decisiones
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
- LLM: no se usa en la demo. Extra documentado en `src/lib/motor/llm.ts` (si se activa: instrucciones separadas de las fuentes con bloques `<<fuente id=… tipo="dato">>`, salida JSON validada contra IDs de evidencia, timeout 15 s, fallback extractivo visible).

## Prompts

Ninguno en la demo (redacción extractiva). Plantillas por tema en `src/lib/motor/paquete.ts` (enfoque y preguntas). Leyenda fija: «Basado únicamente en titular/metadatos del snapshot».

## Límites

Solo titulares y extractos (no se leyó el artículo); GDELT no da fecha de publicación; el modelo e5-small comprime los cosenos (umbral calibrado con etiquetas); clasificación zero-shot con «por revisar» cuando el margen es chico; evaluación exploratoria (sin editor de TVN).
