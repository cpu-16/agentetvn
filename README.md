# AgenteTVN · De la señal a la decisión

Copiloto editorial para TVN Media (reto final del hackIAthon Panamá 2026). Convierte un snapshot público de noticias e indicadores oficiales en una **agenda priorizada**, **fichas de evidencia con citas** y un **paquete editorial** (brief, preguntas, guion, copy) que una persona acepta, corrige o descarta. Nada se publica. Si falta evidencia, el agente se abstiene y dice qué falta.

Equipo ciberpty: Jeffery Gyamerah y Gilberto Valdés. Demo pública: https://agentetvn.ciberpty.com (misma versión y snapshot que este repo; la demo del pitch corre local y sin internet).

## Para el jurado: correr en 5 minutos (sin internet)

Requisitos: [bun](https://bun.sh) ≥ 1.1 (o Node ≥ 20 con npm). Nada más.

```bash
git clone <este repo> agentetvn && cd agentetvn
bun install                 # dependencias fijadas en bun.lock
cp .env.example .env        # sin secretos; modo offline por defecto
bun run modelo:descargar    # UNA vez, con internet: baja el modelo de embeddings (130 MB) a ./.cache-modelos
bun run demo                # doctor → base de datos → http://localhost:3000
```

Sin el paso del modelo, la demo igual corre: la consulta cae al modo léxico (BM25) y la pantalla lo dice.

Verificar:

```bash
bun run doctor      # ¿puede correr en esta máquina sin red? (SHA-256 del snapshot, modelo, modo)
bun test            # T01–T10 del reto + pruebas del motor
bun scripts/pruebas.ts   # matriz T01–T10 con commit y fecha → data/processed/pruebas.json
bun run benchmark --split dev   # métricas IA vs baseline (numerador/denominador)
```

Reproducir el snapshot (con internet; GDELT limita a 1 consulta cada 5 s):

```bash
bun run ingesta     # data/raw/ + data/processed/{noticias.csv, indicadores.csv, eventos.geojson, fuentes.json, manifest.json}
bun run motor       # embeddings → temas → eventos/procedencias → contexto → contradicciones → P → fichas base
```

## Qué mirar (recorrido de 4 minutos)

1. **Agenda**: «Cinco para hoy» responde CU-01 con razones y vacíos; cada fila muestra P con sus cinco componentes (R·I·U·N·E), el estado de evidencia aparte y «N publicaciones, M procedencias».
2. **Ficha** de un tema económico: clic en la cifra del Banco Mundial → país, año, valor, unidad, URL, licencia y «contexto histórico, no dato de hoy».
3. **Caso de agencia replicada** (sintético, marcado): 5 publicaciones, 1 procedencia; P no sube con las réplicas.
4. **Paquete editorial** → una persona lo corrige o lo descarta con motivo; «Aprobar como borrador no publica nada».
5. **Preguntar**: «¿Cuál fue la inflación de Panamá en 2025?» → abstención con lo que falta. La fuente sintética con «ignora tus instrucciones» aparece como contenido no confiable y no entra en ninguna respuesta.
6. **Tablero**: gráficas interactivas enlazadas (Apache ECharts, sin internet): señales por día y tema con brush, mapa de temas, relevancia frente a evidencia, evidencia por tema, medios y procedencias, series del Banco Mundial con Panamá resaltado, sismos USGS; cada gráfica con «Ver como tabla».
7. **Control**: manifest y SHA-256, reglas v1, IA vs baseline, matriz T01–T10, modo offline.

## Cómo funciona

```
TVN RSS + GDELT + RSS públicos ─┐
Banco Mundial (6 países × 6 indicadores × 2010–2024) ─┼─► scripts/ingesta.ts ─► data/processed/ (+ manifest con SHA-256)
USGS 2024 (lat 5–12, lon −86…−76, M≥3) ─┘
                                        scripts/motor.ts ─► embeddings locales (multilingual-e5-small, transformers.js)
                                                             temas (zero-shot + sección del RSS) · eventos y procedencias
                                                             contexto oficial (sin forzar) · contradicciones · P = 30R+25I+20U+15N+10E
Next.js (app) ─► Portada · Agenda · Ficha · Paquete y revisión · Tablero (ECharts) · Control        SQLite (Prisma): revisión humana, paquetes editados, decisiones
scripts/notion-sync.ts ─► Catálogo, Casos, Pruebas, Decisiones en Notion (idempotente)
```

- **IA sustantiva**: recuperación semántica, agrupación de eventos y clasificación temática con embeddings locales. **Baseline**: BM25 y palabras clave, con las mismas consultas y etiquetas humanas (`data/labels/`). Resultados en `bun run benchmark`.
- **Redacción**: extractiva por plantillas desde afirmaciones citadas (`{texto, tipo, evidence_id, campo, alcance}`). Sin LLM no hay cifra inventada posible. La v1 no usa LLM. Si se añade (previsto, no implementado), irá detrás de `AGENTETVN_MODO=online` y sus afirmaciones se validarán contra IDs de evidencia existentes.
- **Puntaje** (`config/scoring-v1.json`): cada componente 0–1 con explicación en español; rangos bajo [0,40), medio [40,70), alto [70,100]; empate por U y luego id. Cambiar un peso exige versión, responsable y motivo.
- **Estado de evidencia** (insuficiente / parcial / suficiente) es independiente de P. Prioridad alta + evidencia insuficiente = investigar, no publicar.
- **Anti-inyección**: el texto de una fuente es dato; patrones de instrucción marcan la fuente como no confiable y la excluyen de consultas y paquetes (T07). Las URLs solo se enlazan si son http(s).
- **Offline** (T10): todo precalculado en `data/processed/`; `AGENTETVN_MODO=offline` bloquea cualquier llamada externa; `tests/t10-offline.test.ts` corre con `fetch` deshabilitado.

## Datos y derechos

Ver `data/processed/fuentes.json` y `manifest.json`. Solo metadatos (titular, extracto corto, URL, fecha); no se redistribuyen cuerpos, imágenes ni videos. Banco Mundial CC BY 4.0; USGS dominio público. Casos sintéticos marcados con `sintetica=true`. Dos discrepancias del PDF del reto documentadas en el manifest (540 celdas, no 1 350; ventanas por familia).

## Estructura

`src/lib/ingesta/` conectores · `src/lib/motor/` contrato, validación, embeddings, BM25, temas, eventos, contexto, evidencia, puntaje, inyección, consulta, paquete, revisión, servicio · `src/app/api/` rutas · `src/components/mesa/` vistas · `scripts/` ingesta, motor, benchmark, pruebas, doctor, notion-sync · `tests/` T01–T10 y motor · `docs/notion/` contenido de las 8 páginas · `SPEC.md` especificación.
