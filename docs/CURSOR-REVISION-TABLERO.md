El periodo que fija el brush y el filtro que alimenta las tarjetas y el resto de gráficas no describen el mismo conjunto de publicaciones. Los nulos del Banco Mundial sí se conservan en el agregado (`src/lib/motor/tablero.ts:84`). El `ResizeObserver` se desconecta y `dispose()` se llama al desmontar (`Grafica.tsx:50`); el problema de ECharts es el ciclo de actualización, no una instancia huérfana.

## 1. El periodo en hora de Panamá no es el filtro de los eventos

`src/lib/motor/tablero.ts:40`, `src/lib/motor/tablero.ts:49`, `src/components/mesa/graficas/tipos.ts:14`

| Antes | Después | Por qué |
| --- | --- | --- |
| Cada publicación entra en `porDiaTema` por `fecha_publicacion ?? fecha_deteccion`, convertida con `America/Panama`. El brush guarda ese `YYYY-MM-DD`. | `filtrarEventos` compara `e.fecha.slice(0, 10)`: la fecha UTC de `fecha_original` (la publicación más antigua del evento) o, si no hay, la detección del representante. Una nota de las 21:00 en Panamá (`2026-10-06T02:00:00Z`) cae en el día 5 del área y en el día 6 del filtro. | El área sigue mostrando esas publicaciones y las tarjetas, el treemap, la dispersión y la evidencia las dejan fuera, o al revés. Además el evento tiene una sola fecha: si el brush cubre solo el día de una nota tardía, el evento desaparece entero; si cubre el día de `fecha_original`, entran todas sus publicaciones, también las de fuera del periodo. |

## 2. Rango y medio no llegan a la serie temporal; medios y procedencias ignoran el filtro

`src/components/mesa/tablero.tsx:43`, `src/components/mesa/tablero.tsx:96`

| Antes | Después | Por qué |
| --- | --- | --- |
| `porDia` solo recorta `desde`/`hasta`. El tema se aplica dentro de `SenalesPorDia` (`SenalesPorDia.tsx:17`). Rango y medio no. | `Medios` dibuja `datos.medios` del corte completo (`MediosProcedencias.tsx:16`) y solo atenúa las barras ajenas al medio activo. `Procedencias` (`MediosProcedencias.tsx:43`) no recibe el filtro. | Con «Alto» o un medio activo, la tarjeta de publicaciones baja y el área apilada no. La dona y las barras de medios siguen contando el corte entero, así que un clic en un tema no se ve en esas dos gráficas. |

## 3. La barra de un medio y el filtro no cuentan lo mismo

`src/lib/motor/tablero.ts:40`, `src/lib/motor/tablero.ts:61`, `src/components/mesa/graficas/tipos.ts:12`

| Antes | Después | Por qué |
| --- | --- | --- |
| La barra suma cada noticia de ese medio y marca agencia si alguna nota trae `agencia`. | El filtro exige `e.medio === filtro.medio`, y `e.medio` es solo el medio de la publicación representante. La tarjeta «medios principales» (`tablero.tsx:51`) es el conjunto de esos representantes, no medios y agencias distintos. | Tras el clic, la cifra de publicaciones incluye notas de otros medios del mismo evento y excluye notas de ese medio cuando otro medio es el representante. El número de la barra no puede coincidir con la tarjeta. |

## 4. «Ver en la agenda» no lleva el mismo conjunto

`src/components/mesa/tablero.tsx:62`, `src/components/mesa/agenda.tsx:38`, `src/components/mesa/agenda.tsx:56`

| Antes | Después | Por qué |
| --- | --- | --- |
| El botón dice «Ver estos {eventos.length} temas» y guarda `filtro.temas` (todos los ids). Está deshabilitado si no hay tema, aunque haya periodo, rango o medio. | La agenda inicializa el selector con `filtroTablero.temas[0]` y filtra `e.tema === tema`. Rango, periodo y medio no viajan. | Con un tema y 12 eventos el botón anuncia 12 temas y la agenda lista todos los eventos de ese tema, no los 12 ya filtrados por rango o fecha. Con dos temas, el segundo se pierde. |

## 5. `setOption` con `notMerge` reinicia el brush y puede borrar el periodo

`src/components/mesa/graficas/Grafica.tsx:58`, `src/components/mesa/graficas/SenalesPorDia.tsx:11`, `src/components/mesa/graficas/SenalesPorDia.tsx:37`

| Antes | Después | Por qué |
| --- | --- | --- |
| El brush, con `throttleDelay: 200`, escribe `desde`/`hasta`. Eso cambia `dias`, la opción y el efecto de `setOption`. | Cada actualización reemplaza la opción (`notMerge: true`) y `trasOpcion` vuelve a lanzar `takeGlobalCursor`. Si el `brushEnd` diferido llega ya con el listener nuevo y sin `areas`, el handler pone `desde` y `hasta` en `undefined` (`SenalesPorDia.tsx:40`). | El recorte se suelta solo, o un `coordRange` del eje anterior se reinterpreta sobre el eje ya recortado y el periodo se encoge. El `dataZoom` y la selección de la leyenda también vuelven al estado inicial. No hay fuga de `ResizeObserver` ni de `dispose`. `chart.off(nombre)` quita todos los handlers de ese evento antes de volver a suscribir; con los `useMemo` actuales no se duplican, pero un `brushEnd` en vuelo sí se reengancha al handler nuevo. |

La leyenda no es un interruptor: al apagar un tema sustituye `filtro.temas` y la serie desaparece del eje (`SenalesPorDia.tsx:44`), así que no se puede volver a encender desde la leyenda.

## 6. La mediana de P es el valor del medio superior

`src/lib/motor/tablero.ts:26`, `src/components/mesa/graficas/MapaTemas.tsx:14`

| Antes | Después | Por qué |
| --- | --- | --- |
| Con un número par de eventos, la mediana es el promedio de los dos centrales. | `sort()[Math.floor(n / 2)]` se queda con el central alto. Con P 10 y 90 el agregado y el treemap muestran 90. | El color y el rótulo «P mediana» suben el puntaje de atención en los temas con conteo par. El mapa repite la misma fórmula, así que las dos vistas coinciden entre sí y las dos se apartan de la mediana. |

## 7. Las barras al 100 % no cierran en 100 y el tooltip no usa el conteo entero

`src/components/mesa/graficas/EvidenciaPorTema.tsx:19`, `src/components/mesa/graficas/EvidenciaPorTema.tsx:26`

| Antes | Después | Por qué |
| --- | --- | --- |
| Cada segmento se redondea solo a un decimal (`Math.round(x * 1000) / 10`) y el eje corta en 100. | 1, 1 y 4 eventos sobre 6 quedan en 16,7 + 16,7 + 66,7 = 100,1 y el último tramo se recorta. El tooltip reconstruye el conteo como `(porcentaje / 100) * total`. | La tabla equivalente sí lleva enteros. La gráfica y el tooltip pueden mostrar un hueco, un recorte o un conteo que no es el del evento. |

## 8. El mes del sismo está en UTC y la fecha del tooltip en Panamá

`src/lib/motor/tablero.ts:90`, `src/components/mesa/graficas/Sismos.tsx:7`

| Antes | Después | Por qué |
| --- | --- | --- |
| `sismosPorMes` usa `s.time.slice(0, 7)`. | El tooltip del mapa formatea la misma hora con `America/Panama` (`Sismos.tsx:7`). Un sismo del `2024-03-01T03:00:00Z` es febrero en Panamá y marzo en la barra. | La barra mensual y la fecha del punto no nombran el mismo mes. El rótulo del eje (`Sismos.tsx:39`) solo traduce ese `YYYY-MM` ya cortado en UTC. |

## 9. El treemap anuncia un color que no pinta, y la trama de «por revisar» no está registrada

`src/components/mesa/graficas/MapaTemas.tsx:19`, `src/components/mesa/graficas/MapaTemas.tsx:23`, `src/components/mesa/graficas/Grafica.tsx:11`

| Antes | Después | Por qué |
| --- | --- | --- |
| En la vista de temas cada nodo lleva `itemStyle.color: colorTema(tema)`. El `visualMap` azul (P 0–100) sigue visible. La trama está en los hijos, y `leafDepth: 1` no los muestra hasta dejar un solo tema. | El patrón `decal` exige el feature modular (`echarts/features/decal`) y `aria.decal.show`. `Grafica.tsx` registra `AriaComponent` y no activa ninguno de los dos. | El jurado lee una rampa de P y ve la paleta categórica. «Por revisar» no se distingue en la vista general, y al entrar al tema la trama tampoco se dibuja. En esa vista de hojas el texto es blanco sobre la rampa, que empieza en `#dbeaf7`. |

## 10. A 390 px la leyenda y los ejes se comen el área de dibujo

`src/components/mesa/graficas/SenalesPorDia.tsx:26`, `src/components/mesa/graficas/RelevanciaEvidencia.tsx:27`, `src/components/mesa/graficas/MediosProcedencias.tsx:47`, `src/components/mesa/graficas/EvidenciaPorTema.tsx:17`

| Antes | Después | Por qué |
| --- | --- | --- |
| Ocho temas con leyenda a 11 px y `grid.top: 40`. La serie «Alto con evidencia insuficiente: investigar» entra en una leyenda con `grid.top: 56`. La dona centra el pastel al 32 % y pone a la derecha nombres largos. Evidencia reserva 130 px a la izquierda para «Logística y Canal» a 12 px, sin `width` ni `overflow`. | El `figure` tiene `overflow-hidden`. | En una columna de 390 px la leyenda pasa a dos o tres líneas, tapa el área o el pastel, y el eje de evidencia se recorta. Medios reserva 150 px de etiquetas más 56 px a la derecha (`MediosProcedencias.tsx:18`): la barra útil queda en torno a un tercio del ancho. |

## 11. Dos temas distintos comparten violeta, y el rojo de tema se confunde con la alerta

`src/components/mesa/graficas/paleta.ts:12`

| Antes | Después | Por qué |
| --- | --- | --- |
| Regulación `#7c3aed` y Otro `#6d28d9` son el mismo violeta. Eventos naturales es `#b91c1c`. | El rojo de alerta es `#d7263d` (`paleta.ts:5`), usado para evidencia insuficiente y para «investigar». | En el área apilada y en el treemap esos dos temas no se separan, y el rojo de «eventos naturales» se lee como la alerta de evidencia. El comentario de la paleta ya marca un aviso de CVD entre verde y marrón. |

## 12. La tabla equivalente no opera la gráfica, y el `role="img"` sigue en el árbol de accesibilidad

`src/components/mesa/graficas/Grafica.tsx:79`, `src/components/mesa/graficas/Grafica.tsx:85`

| Antes | Después | Por qué |
| --- | --- | --- |
| «Ver como tabla» es un botón con `aria-expanded`, pero `aria-controls` apunta a `#id-tabla` solo cuando la tabla está montada. Al abrirla, el contenedor de la gráfica pasa a `sr-only` y conserva `role="img"`. | La tabla no tiene acción para abrir la ficha ni para aplicar tema, medio o periodo. Esas acciones solo existen en el clic del SVG, que no entra en el orden del tabulador. En medios, la tabla lista los 25 del agregado y la barra muestra 15 (`MediosProcedencias.tsx:16` y `:38`). | Quien usa teclado o lector llega a un resumen y a una tabla que no reproduce el filtro ni el clic. Con la tabla abierta, el lector sigue encontrando la imagen. |

## 13. Los tooltips con HTML propio escapan el texto; el enlace USGS no existe y un tooltip de eje no pasa por `esc`

`src/components/mesa/graficas/paleta.ts:60`, `src/components/mesa/graficas/Sismos.tsx:13`, `src/components/mesa/graficas/SenalesPorDia.tsx:27`

| Antes | Después | Por qué |
| --- | --- | --- |
| Titular, lugar y medio pasan por `esc` antes de interpolarse en HTML (`MapaTemas.tsx:33`, `RelevanciaEvidencia.tsx:28`, `MediosProcedencias.tsx:19`, `Sismos.tsx:13`). La prueba de `<img onerror>` cubre ese helper. No hay `<a href>` en el tablero. | El tooltip del sismo no lleva el enlace. La tabla imprime `urlSegura(s.url)` como texto (`Sismos.tsx:33`), así que un `javascript:` no se navega. «Señales por día» usa el tooltip de eje por defecto: ECharts inserta `seriesName` como HTML y ese nombre no pasa por `esc`. `nombreTema` devuelve el id crudo si no está en el mapa (`paleta.ts:33`). | El riesgo práctico es bajo con los ocho temas fijos. El hueco queda abierto si un `tema` fuera de catálogo trae `<`. El enlace USGS pedido en la especificación no está, y tampoco hay un href sin filtrar. |
