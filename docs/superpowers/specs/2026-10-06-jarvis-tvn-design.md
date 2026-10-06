# Jarvis-TVN · diseño (6-oct-2026)

Asistente de voz y texto de la mesa de AgenteTVN. El chat flotante pasa a ser un **orbe azul TVN**. Le hablas manteniéndolo presionado y responde con **voz natural** (realtime de Codex). Hace tres cosas: **responde sobre las noticias con citas**, **explica la pantalla** y **navega la app**. El panel se puede mover y agrandar. Congelamiento del producto: **mié 7-oct, 22:00**.

## Decisiones de Gilberto (6-oct, esta conversación)

| Tema | Decisión |
|---|---|
| Alcance | Voz natural con el patrón realtime de Codex que ya funciona en Hasta Ti, **en una instalación nueva**: sin tocar el CT 129 ni nada de Hasta Ti |
| Capacidades | Responder sobre las noticias, navegar la app y explicar la pantalla (no leer el guion al aire) |
| Arquitectura | Enfoque A: realtime de Codex + Codex como cerebro + 3 herramientas atendidas por un puente propio |
| Micrófono | **Pulsar para hablar**: mantener presionado el orbe (o la barra espaciadora con el panel abierto) |
| Orbe | Azul TVN: núcleo cian claro → `#0077c8` → `#00466f`, halo azul y filo cian girando |
| Panel | Arrastrable por el título (escritorio); tamaños compacto, lateral y amplio; hoja inferior en celular |

Insumos: `hackiathon/encargos/codex-jarvis-voz.out.md` (arquitectura, Codex) y `cursor-jarvis-ux.out.md` (interfaz, Cursor). Base reutilizada: `~/datos/CSS/voz-lab/llamada-web/codex_puente.py` (Hasta Ti, solo lectura) y la demo mínima `~/datos/CODEX-LLAMADA/`.

## Arquitectura

```
Navegador (mesa, sesión con PIN)
  ├─ WebRTC audio ⇄ OpenAI realtime (directo; el servidor no toca el audio)
  ├─ canal oai-events: transcripciones y turnos (para el orbe y el hilo)
  └─ HTTP /api/voz/* ──► Next.js (CT 130 prox, :3000): exige leerSesion, dueño de la llamada
                            └─► puente agentetvn-voz (127.0.0.1:8796, token interno)
                                   └─► codex app-server (JSON-RPC por stdio, login propio)
                                          ├─ thread/realtime/start  v3 · voz «maple» · webrtc
                                          └─ dynamicTools (deferLoading:false) → item/tool/call → puente
                                                 ├─ preguntar_corpus  → Next /api/voz/herramienta (token) → servicio.consulta()
                                                 ├─ explicar_pantalla → contexto de la sección que mandó la página
                                                 └─ navegar           → cola de acciones que la página consulta
```

- **Dónde corre:** el mismo CT 130 de `prox` que AgenteTVN, como unidad aparte `agentetvn-voz.service` (Python, sin dependencias) con su `codex app-server` hijo. Escucha solo en `127.0.0.1:8796`, así que no hay puerto ni hostname nuevo: el túnel sigue entrando solo a Next.
- **Codex:** binario nativo fijado en `/usr/local/bin/codex` (la versión probada en Hasta Ti), con login propio por `codex login --device-auth`. Nunca se copia `auth.json`, porque el refresh token rota. Si es la misma cuenta de ChatGPT, **la cuota es la misma que la de Hasta Ti**.
- **Modelo detrás de la voz:** `gpt-6-luna`, esfuerzo `low`, `baseInstructions` corto, `web_search` desactivado, sin terminal. Solo las 3 herramientas.
- **Autenticación:** Next exige `leerSesion` en cada `/api/voz/*` y asocia cada llamada (`hilo`) a la sesión que la abrió; rechaza un `hilo` ajeno. Next ↔ puente usan un token interno de `/opt/agentetvn/.env`. El PIN y las credenciales nunca llegan al modelo.

## Herramientas (contratos)

| Herramienta | Entrada | Qué hace | Salida para la voz |
|---|---|---|---|
| `preguntar_corpus` | `pregunta`, `eventoId?` | Llama a `servicio.consulta()` con un adaptador autenticado: mismo motor, misma abstención y misma redacción validada de D11. Rechaza un `eventoId` que no exista, en vez de ampliar la búsqueda | `texto_para_leer`: las frases validadas con «Según [medio]…» o, si se abstiene, el motivo y qué falta. La respuesta completa con citas se encola como acción `mostrar` para el hilo |
| `explicar_pantalla` | — | Lee el último contexto que mandó la página (`vista`, `eventoId`, pestaña, filtros) | Texto fijo de la sección (catálogo, 0 tokens de LLM) + resumen de lo visible: título, tema, rango, P, estado de evidencia y revisión, o los filtros del tablero con 3 cifras |
| `navegar` | `destino` ∈ {portada, agenda, tablero, control, ficha}, `eventoId?`, `consulta?` | Valida el destino; para «la ficha de X» resuelve el evento por título con la búsqueda existente (mejor coincidencia; si hay varias, devuelve las opciones). Encola la acción | «Listo, abrí …» o «Encontré tres temas parecidos: …» |

Reglas de la voz (la del acento va AL PRINCIPIO): español de Panamá; de las noticias solo dice lo que devuelven las herramientas, citando el medio; nunca inventa cifras, causas ni culpables; si no hay evidencia, lo dice; nada se publica ni se aprueba por voz. La voz y Codex reciben instrucciones distintas, porque Codex no oye la conversación: la voz le pasa la intención.

**Límite conocido (se documenta y se dice en el pitch):** la voz realtime puede reformular el texto de la herramienta. Mitigación: el hilo muestra al mismo tiempo la respuesta con sus citas, que es lo que se revisa. Una garantía literal exigiría síntesis controlada, y eso queda fuera de este corte.

## Interfaz

- **Orbe** (CSS: `radial-gradient` + `conic-gradient` girando + halo con `blur`; solo `transform` y `opacity`). Reemplaza al botón «Preguntar al agente».
  - Estados: **reposo** (respira cada 4,8 s), **escuchando** (anillo que pulsa con el nivel del micrófono), **pensando** (gira rápido mientras corre una herramienta), **hablando** (late con el audio de salida) y **no disponible** (gris, con texto).
  - Con `prefers-reduced-motion`: quieto y con el estado en texto. Un `aria-live` anuncia los cambios.
- **Pulsar para hablar:** `pointerdown` en el orbe (o la barra espaciadora con el panel abierto) activa la pista del micrófono (`track.enabled = true`); al soltar se desactiva y el VAD de OpenAI cierra el turno. Antes de la primera llamada se explica en una línea.
- **Panel:** dos nodos. El exterior lleva el arrastre (`drag`, `dragControls` desde la barra del título, `dragMomentum={false}`, límites en la ventana); el interior lleva la animación de entrada. Botones Compacto, Lateral y Amplio con `aria-pressed`; en lateral y amplio, `aria-modal=false` y el panel no se cierra con un clic afuera. La posición se guarda en `sessionStorage`. En celular (≤ 640 px): hoja inferior sin arrastre.
- **«Explícame esta pantalla»:** botón en el panel. Inserta el texto fijo de la sección en el hilo sin ninguna llamada (0 tokens). En voz, `explicar_pantalla` usa el mismo catálogo.
- **Contexto de sección:** la página manda `{vista, eventoId, pestaña, filtrosAgenda, filtroTablero}` a `/api/voz/contexto` al abrir la llamada y en cada cambio. La pestaña de la ficha y los filtros de agenda y tablero suben a `src/store/mesa.ts`, que hoy son `useState` locales.
- **Hilo:** lo que dice la persona y la voz (transcripciones de `oai-events`) y las acciones `mostrar` con citas quedan en el mismo hilo del chat. El chat de texto sigue igual (`/api/consulta`).

## Consumo y límites (en el puente, no en la página)

- Una llamada a la vez en todo el sistema; **3 min** por llamada (el puente hace `thread/realtime/stop`); **10 inicios y 20 min por hora**.
- Cuelgue a los 20 s sin hablar, contados con el micrófono suelto y sin herramienta ni audio en curso. Al cerrar la pestaña o salir de la sesión, también se cuelga.
- Registro por llamada en `db/voz-llamadas.jsonl`: duración, tokens de Codex (`thread/tokenUsage/updated`), herramientas usadas y motivo del cierre. La redacción de Claude sigue en `db/llm-intentos.jsonl`.

## Fallas y qué ve la persona

| Falla | Qué pasa |
|---|---|
| Puente o Codex caído, o cuota agotada | Orbe «no disponible»; «La voz no está disponible ahora. Puedes escribir tu pregunta.» El chat sigue funcionando |
| Micrófono denegado o ausente | Una línea con cómo habilitarlo, y el chat de texto a mano |
| Sin internet | No hay voz (el audio va a OpenAI). La demo sin red sigue con el chat y la redacción extractiva (T10 intacto) |
| Herramienta lenta | Orbe «pensando», la voz dice una frase de espera y el cuelgue por silencio se pausa |
| Navegador sin WebRTC o audio bloqueado | «No se pudo activar el audio», con botón para reintentar o seguir por texto |

## Pruebas

- **Next (bun test):** las rutas `/api/voz/*` exigen sesión; un `hilo` de otra sesión → 403; `/api/voz/herramienta` sin token interno → 401; `navegar` rechaza destinos fuera de la lista; `explicar_pantalla` con cada vista devuelve su texto fijo; `preguntar_corpus` con un `eventoId` inexistente no amplía la búsqueda.
- **Puente (`--check` sin red, con un app-server falso):** topes (segunda llamada simultánea rechazada, corte a los 3 min), dispatcher con lista cerrada de herramientas y token interno obligatorio.
- **Control positivo** en sesión, límites y lista cerrada (desactivar → falla → restaurar).
- **En campo (Gilberto, en su laptop y en su celular):** pregunta con evidencia, pregunta sin evidencia (abstención hablada), «explícame esta pantalla» en ficha y tablero, «abre el tablero», «llévame a la ficha de Enrique Lau», micrófono denegado, puente apagado (cae al chat), corte a los 3 min.
- Revisión de Codex (código) y Cursor (interfaz) sobre el diff, como en D11.

## Fuera de este corte

Leer el guion al aire, manos libres, memoria entre llamadas, editar o aprobar por voz, voces personalizadas, varias llamadas simultáneas, soporte exhaustivo en móvil y garantía literal del audio.

## Riesgos

1. **Fidelidad del audio:** la voz puede reformular. El hilo con citas es la referencia, y se ensaya antes del pitch.
2. **Latencia acumulada** (realtime → Luna → Claude): medirla. Si pasa de ~15 s, `preguntar_corpus` usa las afirmaciones extractivas para la voz y deja la redacción de Claude en el hilo.
3. **API experimental del app-server:** fijar la versión de Codex y no actualizarla antes de la entrega.
4. **Tiempo:** ~6 h la voz y ~3 h la interfaz. Si el ensayo falla el miércoles a las 18:00, la voz queda apagada por configuración (`AGENTETVN_VOZ=off`) y se entrega el orbe con el chat.

## Orden de construcción

1. Instalar Codex en el CT 130 + login (Gilberto autoriza el código) + prueba de voz v3 con la demo mínima.
2. Puente `agentetvn-voz` (límites, dispatcher, token) + rutas `/api/voz/*` en Next (sesión, dueño, proxy).
3. Herramientas: `preguntar_corpus`, `explicar_pantalla` (catálogo + resumen), `navegar` (cola + resolución por título).
4. Interfaz: orbe con estados, pulsar para hablar, panel arrastrable con tamaños, «Explícame esta pantalla», hilo con transcripciones y citas.
5. Pruebas, controles positivos, revisión de Codex y Cursor, despliegue, ensayo en campo y decisión D12 en Notion.
