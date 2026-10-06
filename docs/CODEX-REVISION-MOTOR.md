**Informe para `docs/CODEX-REVISION-MOTOR.md`**

Revisión de solo lectura contra las secciones 3, 4, 7, 8 y 9 del reto. No se modificaron archivos.

Se ejecutaron **34 pruebas: 34 pasaron**. Además, se hicieron reproducciones en memoria y lecturas del snapshot. No se ejecutaron los scripts de ingesta/motor ni las pruebas que escriben en SQLite.

Hay fallos de exclusión de fuentes no confiables, abstención, corroboración, trazabilidad y reproducibilidad que las pruebas actuales no detectan. Los hallazgos siguientes están ordenados por gravedad.

**1. Alta — Un representante no confiable llega al título y al copy del paquete**

**Ubicación:** `src/lib/motor/paquete.ts:28–29,39–46,62–64`; `src/lib/motor/servicio.ts:47–54`; `src/lib/motor/consulta.ts:95–100`.

Se filtran las publicaciones usadas para construir `hechos`, pero el representante se obtiene sin comprobar `no_confiable`. El título y el copy reutilizan ese representante.

Además:

- El copy hereda la cita de `hechos[0]`, aunque su texto provenga de otro registro.
- Si todas las publicaciones son no confiables, el copy queda sin `evidence_id`, `campo`, `tipo` ni `alcance`.
- Las procedencias y contradicciones del evento no se depuran. Una consulta que recupera publicaciones permitidas puede devolver contradicciones que incluyen una fuente excluida.
- El servicio devuelve paquetes guardados sin revalidar sus fuentes.

**Caso reproducido:** representante `mal`, marcado no confiable, y publicación permitida `bien`. El copy contiene el titular de `mal` con `evidence_id: "bien"`.

También ocurre en el snapshot actual: el evento sintético `ev_b6c4a2fff66e` genera un copy con el titular de inyección y sin cita.

**Reglas afectadas:** §7, §8, T07 y T09. Esto demuestra contaminación de la salida; no demuestra ejecución de instrucciones ni revelación de secretos.

**Arreglo mínimo:** construir el paquete exclusivamente desde publicaciones permitidas; elegir su representante dentro de ese conjunto; abstenerse si queda vacío; reconstruir o filtrar procedencias, contexto y contradicciones. Validar también los paquetes guardados antes de devolverlos. El texto del copy debe conservar la cita de su fuente real.

**2. Alta — El motor borra una marca previa de `no_confiable`**

**Ubicación:** `scripts/motor.ts:41–44`.

La asignación `no_confiable: d.no_confiable` reemplaza el valor cargado del CSV. Una fuente previamente excluida vuelve a ser confiable cuando su texto no coincide con los patrones del detector.

**Caso concreto:** CSV con `no_confiable=true` y un titular normal, marcado así por revisión humana. Después del motor queda `false`; puede entrar en consultas y paquetes.

**Reglas afectadas:** §8 y T07.

**Arreglo mínimo:** preservar la exclusión:

```ts
no_confiable: n.no_confiable || d.no_confiable
```

Una rehabilitación debería ser una decisión explícita y trazable, separada del detector.

**3. Alta — Algunas consultas temporales reciben una cifra de otro año**

**Ubicación:** `src/lib/motor/consulta.ts:35–41,49–59`.

El año explícito solo se reconoce si comienza por `19` o `20`. La detección de actualidad tampoco reconoce expresiones como «actualmente». Si no encuentra esos patrones, responde con el último valor disponible.

**Casos reproducidos**, con inflación de Panamá disponible únicamente para 2023:

- «Inflación de Panamá en 1899» devuelve **2023: 1,5 %**, con `abstener=false`.
- «Inflación de Panamá actualmente» devuelve el mismo dato histórico, también sin abstención.

El texto sí identifica 2023, pero no responde al período solicitado ni se abstiene por falta del dato.

Existe además dependencia del reloj: «hoy» se resuelve con `new Date().getUTCFullYear()`. El mismo snapshot puede responder en una corrida y abstenerse en otra realizada otro año.

**Reglas afectadas:** §7, CU-04, T04 y T06.

**Arreglo mínimo:** reconocer años explícitos independientemente de su pertenencia al corpus; distinguir «sin período solicitado» de «período solicitado no reconocido/no disponible». Resolver referencias temporales contra una fecha explícita y reproducible —el corte del snapshot en modo demo— y devolverla en la respuesta.

**4. Alta — La recuperación se considera respuesta aunque no sustente la pregunta**

**Ubicación:** `src/lib/motor/consulta.ts:35–38,80–83,91–99`; `src/lib/motor/bm25.ts:42`; `src/lib/motor/contexto.ts:4–10`.

Hay varios caminos:

- Un país no reconocido se sustituye por Panamá.
- Cualquier coincidencia léxica positiva permite responder.
- La rama de indicadores se ejecuta antes de la abstención por causalidad.
- Algunos conceptos distintos se equiparan: «tasa de empleo» conduce al indicador de desempleo; «PIB» conduce siempre a crecimiento anual.

**Casos reproducidos:**

- «Inflación de Argentina en 2023» devuelve inflación de **PAN**.
- «¿Cuántos extraterrestres viven en Panamá?» devuelve «Canal de Panamá sube peajes», con `abstener=false`, por coincidir «Panamá».
- «¿Por qué aumentó la inflación de Panamá en 2023?» devuelve la cifra anual sin activar la abstención por causalidad.

No se inventa necesariamente un número nuevo, pero se presenta evidencia existente como respuesta a otra pregunta.

**Reglas afectadas:** §8, CU-04 y T06.

**Arreglo mínimo:** validar intención, país, concepto y período antes de responder. No sustituir un país explícito no soportado por PAN. Separar «documentos relacionados» de «respuesta sustentada» y abstenerse cuando la evidencia recuperada no contiene el dato o relación solicitados.

**5. Alta — Una réplica de TVN suma corroboración independiente**

**Ubicación:** `src/lib/motor/eventos.ts:41–51`; `src/lib/motor/puntaje.ts:93–101`.

Una noticia sin agencia cuyo medio sea `TVN` recibe inmediatamente la procedencia `medio:TVN`. No pasa por la comprobación de titular copiado.

**Caso reproducido:** una publicación atribuida a EFE y una copia idéntica de TVN sin atribución explícita:

- Antes: una procedencia, `E=0.375`.
- Después: `agencia:EFE` y `medio:TVN`, `E=0.55`.

La réplica añade **1,75 puntos a P** y puede cambiar el estado de evidencia de insuficiente a parcial.

**Reglas afectadas:** §4, CU-03 y T02.

**Arreglo mínimo:** aplicar la comprobación de copia también a TVN. Una copia sin atribución debe quedar con independencia no verificada; pertenecer a un medio concreto no acredita producción independiente.

**6. Alta — Una réplica rejuvenece la prioridad; una recirculación vuelve a sumar novedad**

**Ubicación:** `src/lib/motor/puntaje.ts:78–90`; `src/lib/motor/eventos.ts:21–23`; `scripts/motor.ts:87–94`.

La urgencia usa la publicación más reciente, aunque sea una réplica sin novedades. Por otro lado, titulares idénticos con publicaciones separadas por más de siete días se convierten en eventos distintos. El cálculo de novedad nunca devuelve `repeticion`: únicamente `primera` o `segunda_ola`.

**Casos reproducidos:**

- Original del 30 de septiembre y copia del 6 de octubre, con corte el 6: `U` sube de `0.4` a `1`. La copia añade **12 puntos a P**.
- Original del 30 de septiembre y copia idéntica del 9 de octubre: se forman dos eventos. Sin embeddings ambos reciben `N=1`. Con embeddings coincidentes, el segundo recibe `N=0.3`, aun siendo una repetición sin información nueva.

**Reglas afectadas:** §4, CU-03, T02 y T03.

**Arreglo mínimo:** detectar recirculaciones independientemente de la ventana de agrupación; usar efectivamente `repeticion`. No actualizar la urgencia por una mera réplica: exigir una actualización factual identificada y trazable.

**7. Alta — Contexto histórico o ajeno se convierte en corroboración primaria suficiente**

**Ubicación:** `src/lib/motor/contexto.ts:23–33`; `src/lib/motor/puntaje.ts:93–100`; `src/lib/motor/evidencia.ts:26–30`; `scripts/motor.ts:102`.

El contexto económico siempre busca PAN, sin comprobar el país de la noticia. Cualquier indicador vinculado activa `primaria=true`, aunque únicamente sea contexto histórico y no respalde la afirmación actual.

**Caso reproducido:** titular «Inflación de Argentina dispara precios en 2026», una sola publicación y serie PAN de 2023:

```text
contexto = PAN:FP.CPI.TOTL.ZG:2023
E = 0.825
estado_evidencia = suficiente
```

La fila de Panamá no corrobora la noticia argentina. El mismo problema de suficiencia existe para una afirmación actual sobre Panamá respaldada únicamente por contexto anual histórico.

En sismos, la proximidad temporal y la presencia de «Panamá» tampoco identifican por sí solas el evento; además puede usarse fecha de detección como referencia cuando falta publicación.

**Reglas afectadas:** §3 —no forzar relaciones—, §4 y T04.

**Arreglo mínimo:** distinguir contexto de corroboración. Validar país, período y pertinencia antes de vincular; un indicador histórico puede mostrarse como contexto, pero no debe activar suficiencia de evidencia para hechos actuales que no sustenta.

**8. Alta — El flujo de contradicciones pierde el caso de T05 y genera contradicciones falsas**

**Ubicación:** `src/lib/motor/eventos.ts:21–29`; `scripts/motor.ts:103`; `src/lib/motor/evidencia.ts:16–22`.

La detección solo compara publicaciones previamente agrupadas. En modo léxico, las dos noticias usadas por T05 quedan en eventos distintos:

```text
Deslizamiento deja 3 muertos en Colón
Suben a 5 muertos por deslizamiento en Colón
```

**Resultado reproducido:** dos eventos, ambos sin contradicciones. La prueba pasa porque llama directamente al detector, saltándose la agrupación.

Además, el detector compara todas las cifras que compartan unidad, sin identificar a qué hecho corresponden.

**Segundo caso reproducido:** dos copias idénticas de «Panamá registra 3 muertos y 5 muertos en dos incidentes distintos» producen dos contradicciones falsas: compara el 3 de una copia con el 5 de la otra.

**Reglas afectadas:** CU-04 y T05.

**Arreglo mínimo:** probar la cadena completa en el fallback; agrupar candidatos con diferencias numéricas sin confundir eventos distintos. Comparar cifras asociadas al mismo hecho, lugar y período; si esa correspondencia no puede establecercerse, marcar ambigüedad en lugar de afirmar incompatibilidad.

**9. Alta — Hay citas con ID existente pero campo inexistente o incorrecto**

**Ubicación:** `src/lib/motor/paquete.ts:39–46`; `src/lib/motor/evidencia.ts:16–22`.

La afirmación agregada de procedencias cita `evidence_id=representante` y `campo="procedencias"`. Ese campo pertenece al evento, no a la noticia citada.

Las contradicciones extraen cifras tanto del título como de la descripción, pero siempre asignan `campo="titulo"`. La afirmación que presenta ambas versiones cita únicamente a `c.a`.

**Casos reproducidos:**

- En el snapshot actual, los **75 paquetes** generados en memoria contienen una cita de procedencias hacia un campo inexistente de la noticia.
- Dos títulos «Balance de lluvias en Panamá», con 3 y 5 muertos solamente en sus descripciones, generan una contradicción citada al título.

**Reglas afectadas:** §7 y T09.

**Arreglo mínimo:** citar agregados mediante una evidencia de evento resoluble o mediante sus fuentes constituyentes. Conservar el campo y pasaje de cada cifra durante la extracción; citar ambas versiones. La validación debe comprobar la relación afirmación–campo, no solamente la existencia del ID.

**10. Media — La validación acepta campos obligatorios ausentes y transforma fechas inválidas en válidas**

**Ubicación:** `src/lib/motor/validar.ts:12–15,29,55–62,77–89`; `src/lib/ingesta/comun.ts:15–24`.

En noticias únicamente se exigen ID, título y URL. Se inventan valores por defecto para idioma y origen; una extracción ausente queda `""` sin error.

En indicadores no se validan unidad, URL, extracción ni licencia. `Number("")` y `Number(null)` producen año `0`, que supera `Number.isInteger`. Tampoco se detectan claves país–indicador–año duplicadas.

El parseo de fechas acepta normalizaciones y fechas sin zona horaria.

**Casos reproducidos:**

- `2026-02-30T12:00:00Z` se convierte en **2026-03-02**, sin error.
- Indicador con `anio=""` se acepta como año `0`, sin unidad ni licencia.
- `2026-10-05T12:00:00` se convierte en `12:00Z` con `TZ=UTC` y en `17:00Z` con `TZ=America/Panama`.

Esto último rompe reproducibilidad con idéntico archivo.

**Reglas afectadas:** §3, §7 y T01.

**Arreglo mínimo:** validar todos los campos obligatorios; distinguir ausencia de valor de valores por defecto; rechazar claves anuales vacías y duplicadas. Exigir fechas con zona explícita y calendario válido, normalizando después a UTC y registrando los errores.

**11. Media — Un evento USGS inválido bloquea toda la carga; un tiempo nulo se inventa como 1970**

**Ubicación:** `src/lib/ingesta/usgs.ts:9–21`; `src/lib/motor/cargar.ts:45`.

`parsearUsgs` no valida ni separa errores por evento. Una fecha inválida provoca una excepción durante `toISOString()` y aborta el snapshot completo.

**Casos reproducidos:**

- `time="incorrecta"` provoca `RangeError: Invalid Date`.
- `time=null` y `updated=null` se convierten en `1970-01-01T00:00:00.000Z`.
- Propiedades obligatorias ausentes llegan como `undefined`.

**Reglas afectadas:** §3, §7 y el comportamiento de carga tolerante exigido por T01.

**Arreglo mínimo:** validar cada feature, conservar nulos según contrato o excluir el registro con motivo, y devolver errores separados. No convertir fechas nulas en época Unix ni abortar las filas válidas.

**12. Media — El manifest verifica los CSV, pero el motor utiliza derivados no vinculados a ellos**

**Ubicación:** `src/lib/motor/cargar.ts:28–50`; `scripts/ingesta.ts:76–83`; `scripts/motor.ts:38,55–60,64,109–115`.

El manifest solo incluye hashes de noticias, indicadores, GeoJSON y fuentes. La carga prefiere `noticias-motor.json` y lee eventos, fichas y embeddings sin comprobar que procedan de esos mismos datos.

**Caso concreto:** una ingesta nueva reemplaza los CSV y el manifest, pero quedan derivados de la corrida anterior. La carga verifica los hashes nuevos y luego sirve noticias/eventos antiguos.

La rama léxica tampoco elimina ni invalida `embeddings.json` de una corrida previa. Las etiquetas humanas y los casos sintéticos que cambian el resultado no quedan identificados por el manifest de entradas.

**Reglas afectadas:** §7 y reproducibilidad de §9.

**Arreglo mínimo:** añadir a los derivados una huella de sus entradas, reglas, etiquetas, sintéticas y versión del modelo. Rechazarlos si no coincide. Invalidar embeddings cuando se genera una salida léxica y publicar los resultados como un conjunto consistente.

**13. Media — La caché BM25 mezcla snapshots con igual número de noticias**

**Ubicación:** `src/lib/motor/consulta.ts:28–31,84–99`.

La caché se identifica únicamente por `snap.noticias.length`. Dos snapshots del mismo tamaño reutilizan el índice anterior, aunque sus IDs, textos o marcas de confianza difieran.

`permitida()` también acepta implícitamente un ID ausente: `!undefined` resulta verdadero.

**Caso reproducido:** consultar un snapshot de una noticia con ID `a`; después consultar otro de una noticia con ID `b`. La segunda consulta recupera `a` desde el índice anterior y falla:

```text
TypeError: undefined is not an object (evaluating 'n.medio')
```

Si se mantienen IDs pero cambian textos, puede devolver resultados incorrectos sin excepción. El resultado depende de las consultas previas del proceso.

**Reglas afectadas:** §7, T06 y reproducibilidad.

**Arreglo mínimo:** asociar el índice al snapshot o a una huella de IDs, textos y confianza. Exigir que el ID exista en `porId` antes de aceptarlo.

**14. Media — El fallback offline falla cuando el modelo parece disponible pero no puede cargarse**

**Ubicación:** `src/lib/motor/embeddings.ts:10,16–27`; `src/lib/motor/consulta.ts:78–90`; `scripts/motor.ts:51–59`.

`modeloDisponible()` devuelve verdadero por existir un directorio de caché o por estar habilitadas las descargas. No comprueba que el modelo pueda cargarse.

Si la caché está incompleta/corrupta o falta conexión con descargas habilitadas, `embeber()` lanza una excepción. No hay captura que active BM25 o el motor léxico.

**Caso concreto:** demo sin internet, sin modelo completo y sin `HF_HUB_OFFLINE=1`. Se intenta cargar/descargar y falla antes del fallback. También ocurre con una carpeta `onnx` existente pero incompleta, incluso en modo offline.

**Reglas afectadas:** §8 y T10.

**Arreglo mínimo:** capturar errores de disponibilidad/carga del modelo y activar explícitamente el fallback documentado. Registrar el motivo; no tratar la existencia del directorio como garantía de funcionamiento.

**15. Media — No se garantizan los límites del paquete editorial**

**Ubicación:** `src/lib/motor/paquete.ts:47–48,55–62`.

El brief deja de reducirse cuando quedan dos afirmaciones, aunque todavía supere 250 palabras. El copy no tiene control de longitud. El guion limita parcialmente el máximo, pero no garantiza 45–60 segundos; su fallback incluso puede superar el máximo previsto.

**Casos reproducidos:**

- Una noticia breve produce guion de **22 palabras**.
- Un título de 260 palabras produce brief de **280**, copy de **271** y guion de **272** palabras.
- En el snapshot actual, **68 de 75 guiones** tienen menos de 110 palabras, el mínimo aproximado adoptado por el propio comentario del código.

**Reglas afectadas:** §3 y T09.

**Arreglo mínimo:** aplicar presupuestos efectivos por formato. Si no hay evidencia suficiente para un guion de la duración requerida, devolverlo como incompleto con esa limitación explícita; no rellenar con hechos inventados.

**16. Media — La ventana implementada se aparta de §7 y además admite fechas futuras**

**Ubicación:** `scripts/ingesta.ts:18,40–48,87–92`.

La implementación aplica 90 días anteriores al reloj de ejecución y declara expresamente que no aplica `[2024-01-01, 2025-10-01)`, requerido literalmente por §7.

La discrepancia con §6 está documentada, lo cual evita ocultarla, pero no constituye conformidad con §7.

Incluso aceptando la ventana alternativa, `enVentana()` solo comprueba el límite inferior: admite noticias posteriores al corte y noticias sin fecha.

**Caso concreto:** con corte de octubre de 2026, una noticia fechada en 2030 entra al snapshot. Después obtiene máxima urgencia porque su edad es negativa.

**Reglas afectadas:** §7 y priorización de §4.

**Arreglo mínimo:** hacer explícita y configurable la política temporal acordada; validar ambos extremos. Separar los registros sin fecha y registrar exclusiones. Mantener documentada la excepción al intervalo literal mientras no haya una aclaración del reto.

**Lagunas de las pruebas T01–T10**

Estas pruebas no son inútiles: verifican fragmentos del comportamiento. El problema es que su aprobación no acredita todo el resultado anunciado.

| Prueba y ubicación | Qué puede fallar aunque pase | Ampliación mínima |
|---|---|---|
| **T01** — `tests/t01-carga-con-errores.test.ts:7–32` | Acepta fixtures sin varios campos obligatorios; no cubre fechas ISO imposibles, zona ausente, año vacío ni USGS inválido. | Cargar un snapshot mixto completo y comprobar reporte, conservación de nulos y continuidad. |
| **T02** — `tests/t02-mismo-evento.test.ts:7–29` | Las agencias vienen preasignadas; no calcula P ni prueba una copia idéntica de TVN. | Comparar procedencias, E, N y P antes/después de añadir réplicas con distintas fechas. |
| **T03** — `tests/t03-recirculada.test.ts:7–13` | Solo comprueba fecha original y representante; no pasa por novedad ni urgencia. | Probar recirculación con publicación nueva, tanto dentro como fuera de siete días. |
| **T04** — `tests/t04-cifra-anual.test.ts:9–18` | No llama a `consultar` ni a `generarPaquete`; no verifica la respuesta solicitada por país/año/unidad. | Probar salida final, países no soportados, períodos ausentes y conceptos distintos. |
| **T05** — `tests/t05-contradiccion.test.ts:7–18` | Invoca el detector directamente: sus dos noticias no se agrupan en fallback. | Ejecutar agrupación → contradicción → respuesta/paquete; añadir copias con varias cifras compatibles. |
| **T06** — `tests/t06-sin-respuesta.test.ts:11–35` | Los años negativos están dentro de la expresión regular y la consulta sin respuesta carece de coincidencias útiles. | Añadir 1899, «actualmente», país ajeno, causalidad con indicador y preguntas sin respuesta que compartan «Panamá». |
| **T07** — `tests/t07-inyeccion.test.ts:6–16` | Solo prueba patrones y delimitadores. No recorre CSV → motor → consulta → paquete. | Verificar preservación de la marca y exclusión del representante, copy, contradicciones y paquetes guardados. |
| **T08** — `tests/t08-prioridad-alta.test.ts:9–30` | No comprueba igualdad numérica de la fórmula ni fronteras 40/70/100; el título dice «con agencia», pero el fixture usa una procedencia TVN. | Asertar fórmula y fronteras; probar que las réplicas no elevan importancia. |
| **T09** — `tests/t09-paquete.test.ts:15–27` | Comprueba IDs del brief, no sustento del campo ni citas de copy/guion. El representante siempre es permitido. | Validar todos los formatos, existencia del campo, fuente real, límites y casos sin evidencia permitida. |
| **T10** — `tests/t10-offline.test.ts:6–24` | Solo prueba el entorno disponible. Acepta cualquiera de los modos y no exige respuesta sustentada para la primera consulta. No prueba caché incompleta ni evidencia en Notion. | Ejecutar escenarios separados de caché completa, ausente e incompleta; comprobar respuesta y fallback. Restaurar `fetch` y variables globales al terminar. |

**Aspectos revisados sin fallo directo encontrado**

La suma ponderada utiliza los pesos **30/25/20/15/10**; con la configuración actual, los rangos implementan **[0,40), [40,70), [70,100]** y el orden resuelve empates por **U descendente e ID ascendente**. Los fallos de prioridad descritos provienen principalmente de cómo se calculan sus entradas.

La ingesta GDELT conserva correctamente `seendate` en `fecha_deteccion` y deja nula `fecha_publicacion`. Los valores ausentes del Banco Mundial se conservan como nulos en la cuadrícula. Estas garantías parciales no corrigen las rutas de validación, contextualización y respuesta señaladas arriba.