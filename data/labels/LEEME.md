# Etiquetas humanas (método y tamaño)

- `temas.csv`: una fila por titular. `tema_motor` = lo que dijo el motor (zero-shot); `tema_propuesto` = propuesta del asistente de desarrollo (no cuenta como etiqueta); **`tema`** = etiqueta humana (economia | logistica_canal | turismo | servicios_publicos | eventos_naturales | regulacion | deportes | otro), con `revisado_por` y `fecha`. Solo las filas con `tema` y `revisado_por` entran a la métrica.
- `pares.csv`: pares de titulares con su coseno. **`mismo_evento`** = si | no (mismo hecho, no mismo tema), con `revisado_por` y `fecha`.
- `cinco.csv` (al final): los 5 temas que una persona elige a ciegas, antes de ver el ranking, para Precision@5.
- Regla: si para decidir hay que abrir el artículo, marcar `?` (se excluye y se cuenta como incierta).
