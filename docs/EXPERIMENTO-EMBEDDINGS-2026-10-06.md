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

Máquina: laptop Fedora, i9-13950HX (32 hilos), CPU solamente. El CT de 2 núcleos no se tocó. Para aproximarlo se repiten los tiempos con el pool de ONNX Runtime limitado a 2 hilos (`AGENTETVN_MEDIR_HILOS=2`, solo en el script de medición) y fijado con `taskset -c 4,6` (dos núcleos P distintos). Lo que vale es la razón contra e5 medida igual.

*Ajuste de protocolo durante la corrida:* `taskset` solo no sirve, porque ONNX Runtime fija su propia afinidad y siguió usando ~21 núcleos (`cpu=2019 %` con `taskset -c 4,6`). Una cuota de cgroup (`CPUQuota=200%`) tampoco, porque estrangula ~24 hilos y el e5 pasó de 3,3 s a 97 s por pasada: es una patología del sobre-suscribir, no lo que haría un CT. Con 2 hilos de ORT el proceso queda en `cpu≈195 %`.

- Tiempos (`scripts/medir-embeddings.ts`, proceso nuevo, `HF_HUB_OFFLINE=1`): carga en frío = crear el extractor + primera consulta; corpus = las 1 079 notas de `noticias-motor.json` en lotes de 32 con el modelo ya cargado.
- Motor (`bun run motor`) regenerado solo en este worktree; eventos y eventos con > 1 publicación de `eventos.json`.
- `bun run benchmark --split dev` (38 consultas).
- `bun test tests/` y `scripts/pruebas.ts` (T01–T10, cada una en proceso aparte) con `HF_HUB_OFFLINE=1`; además, la primera consulta de T10 en proceso nuevo con `fetch` bloqueado, verificando que el modo sea `embeddings` y no una caída silenciosa a BM25.

## 5. Resultados

### 5.1 Calibración (sin etiquetas humanas)

| | e5 (referencia) | Granite | Gemma |
|---|---|---|---|
| Paráfrasis duras usadas (Jaccard en [0,2; 0,5)) | 29 de 43 | 29 de 43 | 29 de 43 |
| p10 de paráfrasis duras | 0,9374 | 0,8637 | 0,7465 |
| p99 de negativos (3 000 pares) | 0,8873 | 0,7911 | 0,5006 |
| **Hueco p10 − p99** | **0,0501** | **0,0726** | **0,2459** |
| `umbral_mismo_evento` | 0,90 (vigente; el método daría 0,912) | 0,8274 | 0,6236 |
| Positivos fáciles (Jaccard ≥ 0,8) bajo el umbral | 0 de 19 | 0 de 19 | 3 de 19 (los toma igual el atajo léxico) |
| `umbral_coseno` (mediana de 311 documentos que lo pasan, como el e5 a 0,80) | 0,80 | 0,7093 | 0,1359 |
| `temas.umbral` / `temas.margen` | 0,80 / 0,008 | 0,6355 / 0,0186 | 0,1915 / 0,0481 |
| Notas «por revisar» en temas (985 clasificables) | 54,2 % | 54,2 % | 54,2 % |

Con e5, ninguna nota queda bajo `temas.umbral` = 0,80 (la mínima es 0,8006): hoy solo decide el margen. El umbral equivalente de cada candidato es, por eso, el mínimo de su distribución.

### 5.2 Calidad, eventos y pruebas

| | e5 | Granite-97M r2 q8 | EmbeddingGemma-300M q8 |
|---|---|---|---|
| hit@5 sustentadas (dev) | 17/20 | **16/20** | **18/20** |
| Abstenciones correctas / indebidas | 6/7 · 0/20 | 6/7 · 0/20 | 6/7 · 0/20 |
| Adversarial | 6/6 | 6/6 | 6/6 |
| Citas | 38/38 | 38/38 | 38/38 |
| Contradicción | 5/5 | 5/5 | 5/5 |
| Latencia de consulta en el benchmark (mediana / p95) | 6 / 12 ms | 6 / 10 ms | 101 / 118 ms |
| Eventos | 777 | 787 | 791 |
| Eventos con > 1 publicación (Δ vs e5) | 137 | 136 (−0,7 %) | 132 (−3,6 %) |
| T01–T10 (`scripts/pruebas.ts`, `HF_HUB_OFFLINE=1`) | 10/10 | 10/10 | 10/10 |
| `bun test tests/` | 107/107 | 104/107 | 104/107 |
| Primera consulta T10 en proceso nuevo, `fetch` bloqueado | 0,47–0,56 s, modo `embeddings`, 0 intentos de red | 0,55 s, `embeddings`, 0 | 0,79–0,87 s, `embeddings`, 0 |

Los 3 fallos de los candidatos son los de `tests/tablero-snapshot.test.ts`, que fija conteos del snapshot e5 (774 eventos visibles, 74 procedencias TVN, 7 publicaciones de regulación el 1-oct). Cambian porque cambia el agrupamiento; no son T01–T10.

Casos de dev que cambian: Granite pierde b08 («Más allá del 7 de septiembre»); Gemma gana b11 («El legado evoluciona»). Los tres fallan b01 y b07, y ninguno se abstiene en b42 (peaje del Canal de septiembre de 2026). La diferencia de Gemma es un caso de 20.

### 5.3 Tiempos en esta máquina

Corpus = 1 079 pasajes en lotes de 32 con el modelo ya cargado (dos pasadas por proceso, dos procesos). Frío = proceso nuevo: cargar desde `.cache-modelos` y embeber la primera consulta.

| | e5 | Granite | Gemma |
|---|---|---|---|
| Corpus, ORT por defecto (~21 núcleos) | 3,1–4,0 s | 3,4–3,7 s (≈ 1,0×) | 25,5–26,8 s (**≈ 7,7×**) |
| Corpus, 2 hilos de ORT | 5,6 s | 5,9–6,4 s (≈ 1,1×) | 58,3–59,3 s (**≈ 10,5×**) |
| Carga en frío + 1.ª consulta (defecto / 2 hilos) | 0,44–0,64 s / 0,52–0,56 s | 0,49–0,59 s / 0,49–0,55 s | 0,73–0,83 s / 0,82 s |
| Consulta caliente (mediana; defecto / 2 hilos) | 3–6 ms / 3–5 ms | 3–4 ms / 5–7 ms | 101–112 ms / 92 ms |
| `bun run motor` completo (defecto / taskset, que ORT ignora) | 7,8 s / 7,9 s | 8,0 s / 8,4 s | 33,2 s / 34,1 s |
| Memoria máxima del proceso | 0,85–0,91 GB | 0,72–0,79 GB | 1,9–2,1 GB |
| Modelo en disco | 130 MB | 118 MB | 316 MB |

### 5.4 Con el corte relativo del repo principal (`MARGEN_COSENO`)

Pedido del coordinador. En `main`, `consultar()` deja entrar solo lo que queda a ≤ 0,02 de la mejor. Para los candidatos el margen se reescaló con el mismo método de selectividad: las 50 pseudoconsultas deben dar la misma media de evidencias que el e5 con 0,02 (3,42). Granite queda en 0,0279 y Gemma en 0,0927. El corte se aplicó con un parche temporal que no se comiteó.

| | hit@5 | Abst. correctas / indebidas | Adversarial | Citas | Evidencias por consulta |
|---|---|---|---|---|---|
| e5, sin corte / con 0,02 | 17 / 17 | 6/7 · 0 | 6/6 | 38/38 | 3,84 → 1,55 |
| Granite, sin corte / con 0,0279 | 16 / **14** | 6/7 · 0 | 6/6 | 38/38 | 3,84 → 1,87 |
| Gemma, sin corte / con 0,0927 | 18 / **17** | 6/7 · 0 | 6/6 | 38/38 | 3,84 → 1,71 |

Con el corte que ya está en `main`, Gemma empata con e5 en hit@5 y Granite queda más abajo.

## 6. Veredicto: quedarse con e5

Ningún candidato cumple los seis criterios.

- **Granite-97M r2.** Cuesta lo mismo que e5 (≈ 1,0–1,1× en CPU, menos memoria) y abre un hueco algo mayor (0,073 contra 0,050), pero **hit@5 baja a 16/20** (criterio 2), y con el corte relativo a 14/20. Queda fuera.
- **EmbeddingGemma-300M.** Gana en separación: el hueco es 0,246, unas cinco veces el del e5, y Gemma es el único con margen real para un umbral de «mismo evento». También gana un caso de dev (18/20). Mantiene abstención, adversarial, citas, contradicción, T01–T10 y la consulta en frío bajo 1 s, sin salir a la red, y los eventos con > 1 nota se mueven −3,6 %. Pero **embeber el corpus cuesta ≈ 7,7× el e5 con todos los núcleos y ≈ 10,5× con 2 hilos** (criterio 5, tope 3×). Además la consulta pasa de ~5 ms a ~100 ms y el proceso de ~0,9 a ~2 GB. Con el corte relativo de `main`, el +1 de hit@5 desaparece: 17/20, empate. Así cae también en el criterio 6: gana un eje y pierde otro.

La hipótesis se cumple a medias. Gemma sí abre el hueco ≥ 0,05 y sube el hit@5 sin el corte, pero no dentro del presupuesto de CPU. Granite cumple el presupuesto, pero no la calidad.

### Qué haría falta para adoptar Gemma (si se reabre)

1. Aceptar de forma explícita un presupuesto de CPU mayor: el motor corre una vez por snapshot (~33 s aquí; en el CT, ~1 min por cada 1 000 notas si escala como con 2 hilos), y la consulta sube a ~100 ms. Antes hay que confirmar que el CT tiene ~2 GB libres para el proceso.
2. Medir en el CT real (aquí solo se aproximó).
3. Ampliar dev: +1 de 20 casos es ruido, y con el corte de `main` es empate. El reservado se usaría una sola vez, para confirmar después de decidir.
4. Regenerar el snapshot con `AGENTETVN_EMB_MODELO=gemma bun run motor`, actualizar los conteos de `tests/tablero-snapshot.test.ts`, descargar el modelo (316 MB) en la caché del CT y reescalar `MARGEN_COSENO` (≈ 0,093).
5. Revisar la licencia: EmbeddingGemma va bajo los Gemma Terms of Use. e5 es MIT y Granite es Apache-2.0.

Un siguiente experimento con una sola perilla sería Gemma en q4 (`model_q4.onnx`), para ver si baja el costo sin perder el hueco. No se probó.

### Reproducir

```
AGENTETVN_EMB_MODELO=gemma HF_HUB_OFFLINE=0 bun scripts/modelo-descargar.ts       # una vez, con red
AGENTETVN_EMB_MODELO=e5 HF_HUB_OFFLINE=1 bun scripts/calibrar-embeddings.ts --referencia
AGENTETVN_EMB_MODELO=gemma HF_HUB_OFFLINE=1 bun scripts/calibrar-embeddings.ts
AGENTETVN_EMB_MODELO=gemma HF_HUB_OFFLINE=1 bun scripts/medir-embeddings.ts
AGENTETVN_EMB_MODELO=gemma HF_HUB_OFFLINE=1 bun run motor && bun run benchmark --split dev   # reescribe data/processed: no comitear
```

Sin la variable rige e5. En este worktree, `bun run motor` regenera `eventos.json`, `embeddings.json`, `fichas.jsonl` y `noticias-motor.json` idénticos al snapshot comiteado, y `motor-meta.json` con la misma huella.

Nota para fusionar: `consulta.ts` cambió en `main` (traza, `MARGEN_COSENO`). La línea de `usarEmb` de esta rama, que cae a BM25 si `snap.embeddings.modelo` no coincide con el modelo, se tiene que llevar a mano.
