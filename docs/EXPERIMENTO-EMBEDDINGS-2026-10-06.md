# Experimento A/B de embeddings · 6-oct-2026

Rama `exp/embeddings-ab`. Plan: `hackiathon/encargos/cursor-embeddings-ab.out.md` (Cursor). El modelo entra como **perfil** (`AGENTETVN_EMB_MODELO`); el defecto sigue siendo `e5` (`Xenova/multilingual-e5-small`, q8, 384) con las cadenas y los umbrales de `config/scoring-v1.json`. El split **reservado** del benchmark no se abre ni se usa para elegir.

## 1. Hipótesis (escrita antes de embeber con cualquier candidato)

> En noticias de Panamá en español, EmbeddingGemma-300M q8 (o Granite-97M q8), con sus prefijos y con umbrales reestimados por percentiles, sube el hit@5 de dev por encima de 17/20 y/o abre un hueco ≥ 0,05 entre paráfrasis y pares de otro tema, sin bajar abstención, adversarial ni citas, y embebiendo las ~1 079 notas en menos de 3× el e5-small q8. El reservado no se usa para elegir.

**No cambiar** (el defecto sigue siendo e5) si ocurre cualquiera de estas:

1. Falla alguna de T01–T10, o la consulta en frío pasa de 15 s.
2. hit@5 < 17, abstenciones indebidas > 0, adversarial < 6/6 o citas < 38/38.
3. El hueco p10(paráfrasis duras) − p99(negativos) es < 0,05: no hay umbral que separar.
4. El número de eventos con más de una nota se mueve más de un 15 % respecto del e5.
5. El embebido del corpus supera 3× el e5 en la misma máquina, o con `HF_HUB_OFFLINE=1` el modelo intenta salir a la red.
6. Empate, o gana un eje y pierde otro.

## 2. Perfiles

| id | Repo ONNX | dtype | dims | Pooling (según su ficha) | Prefijo consulta | Prefijo pasaje |
|---|---|---|---|---|---|---|
| `e5` (defecto) | `Xenova/multilingual-e5-small` | q8 | 384 | media | `query: ` | `passage: ` |
| `gemma` | `onnx-community/embeddinggemma-300m-ONNX` | q8 | 768 | salida `sentence_embedding` del ONNX (media + 2 capas densas) | `task: search result \| query: ` | `title: none \| text: ` |
| `granite` | `onnx-community/granite-embedding-97m-multilingual-r2-ONNX` | q8 | 384 | CLS | (ninguno) | (ninguno) |

Comprobado antes de descargar (API de Hugging Face, 6-oct): los dos repos existen y traen `onnx/model_quantized.onnx` (lo que transformers.js 3.8.1 carga con `dtype: "q8"`); Gemma `model_type: gemma3_text` y Granite `model_type: modernbert`, ambos registrados en `@huggingface/transformers@3.8.1`. Granite R2 declara `prompts: {query: "", document: ""}` y `pooling_mode_cls_token: true` en su `config_sentence_transformers.json` / `1_Pooling/config.json`.

**Desvío del plan, decidido antes de embeber:** el plan mantenía `pooling: "mean"` para todos. Eso invalida a los dos candidatos igual que copiar `query: ` invalidaría a Granite: Granite se entrenó con CLS, y en Gemma el embedding entrenado es la salida `sentence_embedding` (media + proyección densa 768→3072→768), no la media del último estado oculto que calcula `pipeline("feature-extraction")`. El perfil lleva su pooling oficial; el e5 conserva media.

## 3. Recalibración sin etiquetas humanas

`scripts/calibrar-embeddings.ts`. Primero se corre con `e5` (`--referencia`) para fijar la selectividad de hoy; luego con cada candidato.

- **`umbral_mismo_evento`.** Pasajes como en el motor (`título. extracto`, corte 600; 981 de 1 079 notas no traen extracto). Positivos fáciles: pares con Jaccard de titular ≥ 0,8 (control: deben quedar arriba del umbral). Positivos duros: `data/calibracion/parafrasis-2026-10-06.json` (43 paráfrasis fijas, escritas antes de embeber), solo las de Jaccard en [0,2; 0,5). Negativos: hasta 3 000 pares al azar (semilla fija) a ≤ 7 días por fecha de referencia, `temaPorPalabras` distinto (los dos con tema) y Jaccard < 0,2. Umbral = punto medio entre p10(duros) y p99(negativos), válido solo si el hueco ≥ 0,05; si no, se usa igual el punto medio para poder medir el resto y el criterio 3 queda en rojo.
- **`umbral_coseno` (consulta).** 50 titulares (muestra fija) como pseudoconsultas con prefijo de consulta, leave-one-out contra el resto. Con e5 se cuenta cuántos documentos pasan 0,80 por consulta y se toma la mediana M. Con el candidato se busca el umbral cuya mediana de documentos que lo pasan es M.
- **`temas.umbral` y `temas.margen`.** Sobre las notas que el motor clasifica (no deportes), con los prototipos de `config/temas.json`: se mide con e5 la fracción con similitud máxima ≥ 0,8 y la fracción con margen < 0,008, y en el candidato se toman los cuantiles que reproducen esas mismas fracciones.

## 4. Protocolo de medición

Máquina: laptop Fedora, i9-13950HX (32 hilos), CPU solamente. El CT de 2 núcleos no se tocó; para aproximarlo se repiten los tiempos con `taskset -c 4,6` (dos núcleos P distintos). Lo que vale es la razón contra e5 medida igual.

- Tiempos (`scripts/medir-embeddings.ts`, proceso nuevo, `HF_HUB_OFFLINE=1`): carga en frío = crear el extractor + primera consulta; corpus = las 1 079 notas de `noticias-motor.json` en lotes de 32 con el modelo ya cargado.
- Motor (`bun run motor`) regenerado solo en este worktree; eventos y eventos con > 1 publicación de `eventos.json`.
- `bun run benchmark --split dev` (38 consultas).
- `bun test tests/` y `scripts/pruebas.ts` (T01–T10, cada una en proceso aparte) con `HF_HUB_OFFLINE=1`; además, la primera consulta de T10 en proceso nuevo con `fetch` bloqueado, verificando que el modo sea `embeddings` y no una caída silenciosa a BM25.

## 5. Resultados

(pendiente)

## 6. Veredicto

(pendiente)
