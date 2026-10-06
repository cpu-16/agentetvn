# Riesgos y ética · AgenteTVN

| Riesgo | Control | Evidencia |
|---|---|---|
| Cita formal sin sustento (texto que añade detalles al titular) | Afirmaciones tipadas con `evidence_id`; redacción extractiva; cifras insertadas desde la fila oficial; leyenda «basado únicamente en titular/metadatos» | T04, T09; auditoría humana de ≥30 afirmaciones |
| Contar réplicas como corroboración | Publicación ≠ evento ≠ procedencia; agencia replicada = 1; sin atribución = «independencia no verificada» | T02, caso sintético de 5 réplicas EFE |
| Presentar un dato anual como actual | País, año, unidad y «contexto histórico» en cada cita; abstención si el año pedido no existe | T04, T06 |
| Inyección desde una fuente | Texto de fuente = dato; detector de patrones marca «no confiable» y excluye; el agente no tiene herramientas de publicación ni acceso a secretos; URLs solo http(s) | T07, 10 consultas adversariales |
| Alucinación | Sin LLM en la demo; si se activa, salida validada contra IDs existentes y fallback extractivo | T06 |
| Privacidad y reputación | No se almacenan datos personales; acusaciones se muestran como «declaración», no hecho; no hay listas de personas | Diseño del contrato |
| Derechos de las fuentes | Solo metadatos; sin cuerpos, imágenes ni videos; condiciones por fuente en `fuentes.json`; GDELT no transfiere derechos | Catálogo de datos |
| Sesgo del ranking | Prior editorial por tema declarado y versionado; pesos del reto; cambio exige motivo; Precision@5 contra selección a ciegas | Control, decisiones |
| Secretos | `.env` ignorado; `.env.example` vacío; nada en Notion ni capturas | `bun run doctor` |
| Fuera de alcance | No se detecta falsedad, culpabilidad, fraude ni riesgo de crédito; «aprobar como borrador» no publica | Texto fijo en la UI |

Una alerta es una invitación a investigar. La persona revisora conserva la decisión editorial.
