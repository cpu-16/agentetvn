# Riesgos y ética · AgenteTVN

| Riesgo | Control | Evidencia |
|---|---|---|
| Cita formal sin sustento (texto que añade detalles al titular) | Afirmaciones tipadas con `evidence_id`; redacción extractiva; cifras insertadas desde la fila oficial; leyenda «basado únicamente en titular/metadatos» | T04, T09; auditoría humana de ≥30 afirmaciones |
| Contar réplicas como corroboración | Publicación ≠ evento ≠ procedencia; agencia replicada = 1; sin atribución = «independencia no verificada» | T02, caso sintético de 5 réplicas EFE |
| Presentar un dato anual como actual | País, año, unidad y «contexto histórico» en cada cita; abstención si el año pedido no existe | T04, T06 |
| Acceso sin PIN a lo editorial | Todas las rutas de la mesa exigen la sesión (cookie firmada): lecturas de agenda, tablero, control y evento incluidas (antes solo las escrituras y el chat); el despliegue verifica 401 sin sesión | `tests/api-sesion.test.ts`, `deploy/desplegar.sh` |
| Inyección desde una fuente | Texto de fuente = dato; detector de patrones marca «no confiable» y excluye; el agente no tiene herramientas de publicación ni acceso a secretos; URLs solo http(s) | T07, 10 consultas adversariales |
| Alucinación | Offline: sin LLM. Online (D11): el LLM solo reescribe evidencia recuperada; cada frase se valida contra su fuente (ID, tipo, cifras, citas, nombres, causas) y lo inválido se descarta; respaldo extractivo; abstenciones sin LLM. Límite: la validación es léxica, no semántica (una paráfrasis que cambie el sentido sin cambiar cifras ni nombres pasa); por eso la revisión humana sigue siendo obligatoria | T06, T09, `tests/llm.test.ts` |
| Privacidad y reputación | No se almacenan datos personales; acusaciones se muestran como «declaración», no hecho; no hay listas de personas | Diseño del contrato |
| Derechos de las fuentes | Solo metadatos; sin cuerpos, imágenes ni videos; condiciones por fuente en `fuentes.json`; GDELT no transfiere derechos | Catálogo de datos |
| Sesgo del ranking | Prior editorial por tema declarado y versionado; pesos del reto; cambio exige motivo; Precision@5 contra selección a ciegas | Control, decisiones |
| Secretos | `.env` ignorado; `.env.example` vacío; nada en Notion ni capturas | `bun run doctor` |
| Fuera de alcance | No se detecta falsedad, culpabilidad, fraude ni riesgo de crédito; «aprobar como borrador» no publica | Texto fijo en la UI |
| La voz reformula lo que devuelve la herramienta | La voz solo lee el texto de las herramientas, que viene del motor validado y empieza por el medio («Según TVN…»); el hilo muestra al mismo tiempo la respuesta con sus citas; la revisión humana es obligatoria. Límite: no hay garantía literal del audio | `tests/voz-herramientas.test.ts`, prueba en campo |
| Consumo de la cuota de voz (compartida con otra demo) | Topes en el puente (1 llamada, 3 min, 10 por hora, 20 min por hora), cuelgue por silencio, pestaña oculta o página abandonada, y cierre a prueba de fallas | `voz/puente.py --check`, `tests/voz-rutas.test.ts` |
| Acceso a la voz | Todas las rutas de la página exigen la sesión; las del puente, un token interno de 32 hex; el dueño de cada llamada es la sesión que la abrió | `tests/voz-rutas.test.ts` |

Una alerta es una invitación a investigar. La persona revisora conserva la decisión editorial.
